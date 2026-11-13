import { base64UrlToString, stringToBase64Url } from "../base64url.ts";
import type { Env } from "../env.ts";
import { Relay, type RelaySocket } from "../relay.ts";
import type { TicketClaims, TicketRole } from "../tickets.ts";

interface Attachment {
  claims: TicketClaims;
  lastSeen: number;
}

const SWEEP_INTERVAL_MS = 15_000;
const BINDING_KEY = "binding";

interface SessionBinding {
  sessionId: string;
  repository: string;
}

/**
 * One Durable Object per AETHER session. It owns the two WebSockets for that
 * session and forwards frames between them.
 *
 * Hibernation is enabled: while both peers are idle the object is evicted and
 * costs nothing, then state is restored from socket attachments. Payloads are
 * never written to storage, read, or logged.
 */
export class RelaySession implements DurableObject {
  private readonly ctx: DurableObjectState;
  private readonly env: Env;
  private relay = new Relay();
  private readonly sockets = new Map<WebSocket, RelaySocket>();
  private readonly hydrated = new Set<WebSocket>();
  private readonly participants = new Map<WebSocket, { role: TicketRole; claims: TicketClaims }>();
  private sessionId: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/state") {
      const binding = await this.ctx.storage.get<SessionBinding>(BINDING_KEY);
      const live = this.ctx.getWebSockets().length;
      return Response.json({
        session: binding?.sessionId ?? null,
        repository: binding?.repository ?? null,
        connections: live,
      });
    }

    if (url.pathname !== "/join") {
      return new Response("Not found", { status: 404 });
    }
    if ((request.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const encoded = request.headers.get("x-aether-claims");
    if (!encoded) {
      return new Response("Missing claims", { status: 401 });
    }
    let claims: TicketClaims;
    try {
      claims = JSON.parse(base64UrlToString(encoded)) as TicketClaims;
    } catch {
      return new Response("Malformed claims", { status: 400 });
    }
    if (claims.role !== "app" && claims.role !== "worker") {
      return new Response("Unknown role", { status: 400 });
    }

    // Bind the session to one repository for its whole life. A ticket from a
    // different repository can never join an existing session.
    const binding =
      (await this.ctx.storage.get<SessionBinding>(BINDING_KEY)) ?? null;

    if (!binding) {
      await this.ctx.storage.put<SessionBinding>(BINDING_KEY, {
        sessionId: claims.sessionId,
        repository: claims.repository,
      });
      this.sessionId = claims.sessionId;
    } else if (
      binding.repository !== claims.repository ||
      binding.sessionId !== claims.sessionId
    ) {
      return new Response("Session is bound to another repository", { status: 403 });
    }

    for (const existing of this.ctx.getWebSockets()) {
      const attachment = existing.deserializeAttachment() as Attachment | null;
      if (attachment?.claims.role === claims.role) {
        try {
          existing.close(4001, "replaced");
        } catch {
          // already closing
        }
        this.forget(existing);
      }
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: Attachment = { claims, lastSeen: Date.now() };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);
    this.participants.set(server, { role: claims.role, claims });
    this.hydrated.add(server);

    const socket = this.socketFor(server);
    this.relay.attach(claims, socket, Date.now());
    await this.armSweep();
    this.notify("join", claims.role);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      ws.close(1003, "text frames only");
      return;
    }
    this.hydrate();
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (!attachment) {
      ws.close(1011, "missing state");
      return;
    }
    const result = this.relay.receive(attachment.claims, this.socketFor(ws), message);
    if (!result.ok) {
      this.forget(ws);
      return;
    }
    attachment.lastSeen = Date.now();
    try {
      ws.serializeAttachment(attachment);
    } catch {
      // socket closed underneath us
    }
    await this.armSweep();
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _clean: boolean): Promise<void> {
    this.forget(ws);
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.forget(ws);
  }

  async alarm(): Promise<void> {
    this.hydrate();
    const now = Date.now();
    this.relay.sweep(now);
    const live = this.ctx.getWebSockets();
    if (live.length <= 1) {
      // Nothing to observe: stop paying for alarms until someone joins again.
      return;
    }
    await this.ctx.storage.setAlarm(now + SWEEP_INTERVAL_MS);
  }

  /* ---------------------------------------------------------------- */

  private socketFor(ws: WebSocket): RelaySocket {
    const existing = this.sockets.get(ws);
    if (existing) {
      return existing;
    }
    const socket: RelaySocket = {
      send: (data: string): void => {
        try {
          ws.send(data);
        } catch {
          // peer vanished; the relay will drop the frame
        }
      },
      close: (code?: number, reason?: string): void => {
        try {
          ws.close(code, reason);
        } catch {
          // already closed
        }
      },
    };
    this.sockets.set(ws, socket);
    return socket;
  }

  /** Rebuild relay state from live sockets after a hibernation wake-up. */
  private hydrate(): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (this.hydrated.has(ws)) {
        continue;
      }
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (!attachment) {
        continue;
      }
      this.relay.attach(attachment.claims, this.socketFor(ws), attachment.lastSeen);
      this.hydrated.add(ws);
      this.participants.set(ws, { role: attachment.claims.role, claims: attachment.claims });
    }
  }

  private forget(ws: WebSocket): void {
    const participant = this.participants.get(ws);
    if (participant) {
      this.relay.detach(participant.claims.sessionId, participant.role, this.socketFor(ws));
      this.notify("leave", participant.role);
    }
    this.participants.delete(ws);
    this.hydrated.delete(ws);
    this.sockets.delete(ws);
  }

  private notify(event: "join" | "leave", role: TicketRole): void {
    const stub = this.env.REGISTRY.get(this.env.REGISTRY.idFromName("aether-relay-registry"));
    const body = JSON.stringify({ session: this.claimsSessionId(), role, event });
    this.ctx.waitUntil(
      stub
        .fetch("https://registry/event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        })
        .catch(() => undefined),
    );
  }

  private claimsSessionId(): string {
    if (this.sessionId) {
      return this.sessionId;
    }
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (attachment) {
        this.sessionId = attachment.claims.sessionId;
        return this.sessionId;
      }
    }
    return this.participants.values().next().value?.claims.sessionId ?? "unknown";
  }

  private async armSweep(): Promise<void> {
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null) {
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
    }
  }
}

/** Serialises claims for the internal Worker → Durable Object hop. */
export function encodeClaims(claims: TicketClaims): string {
  return stringToBase64Url(JSON.stringify(claims));
}
