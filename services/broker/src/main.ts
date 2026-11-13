import { parseConfig } from "./config.ts";
import { KvTicketBackend, type KvLike } from "./deno_kv.ts";
import { GitHubAppAuth } from "./github.ts";
import { createHandler } from "./http.ts";
import { verifyActionsOidc } from "./oidc.ts";
import { Relay } from "./relay.ts";
import { TicketService } from "./tickets.ts";
import type { TicketClaims } from "./tickets.ts";

const config = parseConfig(Deno.env.toObject());
const kv = (await Deno.openKv()) as KvLike;
const github = await GitHubAppAuth.create({
  appId: config.githubAppId,
  privateKeyPem: config.githubAppPrivateKey,
  apiBaseUrl: config.githubApiBaseUrl,
});

const tickets = new TicketService(new KvTicketBackend(kv));
const relay = new Relay();
const handler = createHandler({
  config,
  github,
  tickets,
  relay,
  oidc: (token: string) =>
    verifyActionsOidc(token, {
      audience: config.relayAudience,
      allowedRepository: config.allowedRepository,
    }),
  version: Deno.env.get("AETHER_VERSION") ?? "0.1.0",
});

// Reap silent sessions even if no new frames arrive.
setInterval(() => relay.sweep(), 15_000);

Deno.serve(async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  if (url.pathname === "/relay") {
    return await handleRelay(request, url);
  }
  return await handler(request);
});

async function handleRelay(request: Request, url: URL): Promise<Response> {
  if ((request.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
    return new Response("Expected a WebSocket upgrade", { status: 426 });
  }
  const ticket = url.searchParams.get("ticket");
  if (!ticket) {
    return new Response("Missing ticket", { status: 401 });
  }
  const claims: TicketClaims | null = await tickets.consume(ticket);
  if (!claims) {
    return new Response("Invalid or expired ticket", { status: 401 });
  }

  const { socket, response } = Deno.upgradeWebSocket(request);
  const bridge = {
    send: (data: string): void => {
      try {
        socket.send(data);
      } catch {
        // socket already closing
      }
    },
    close: (code?: number, reason?: string): void => {
      try {
        socket.close(code, reason);
      } catch {
        // already closed
      }
    },
  };

  socket.onopen = (): void => relay.attach(claims, bridge);
  socket.onmessage = (event: MessageEvent): void => {
    if (typeof event.data !== "string") {
      socket.close(1003, "text frames only");
      return;
    }
    relay.receive(claims, bridge, event.data);
  };
  socket.onclose = (): void => relay.detach(claims.sessionId, claims.role, bridge);
  socket.onerror = (): void => relay.detach(claims.sessionId, claims.role, bridge);

  return response;
}
