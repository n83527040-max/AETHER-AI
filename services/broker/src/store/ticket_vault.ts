import type { TicketBackend, TicketClaims } from "../tickets.ts";
import type { Env } from "../env.ts";

interface StoredTicket {
  claims: TicketClaims;
  expiresAt: number;
}

const PREFIX = "t:";
const SWEEP_INTERVAL_MS = 60_000;

function key(id: string): string {
  return `${PREFIX}${id}`;
}

/**
 * Durable Object that owns every unspent ticket.
 *
 * A Durable Object processes one event at a time, and its input gate blocks
 * other requests while a storage call is in flight. `take` therefore reads and
 * deletes without any possibility of a second caller observing the same record,
 * which is what makes tickets strictly single-use even under concurrency.
 */
export class TicketVault implements DurableObject {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState, _env: Env) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/put") {
      const body = (await request.json()) as {
        id?: unknown;
        claims?: unknown;
        ttlMs?: unknown;
      };
      if (typeof body.id !== "string" || !body.claims || typeof body.ttlMs !== "number") {
        return Response.json({ error: "invalid_request" }, { status: 400 });
      }
      const claims = body.claims as TicketClaims;
      const ttlMs = Math.min(Math.max(body.ttlMs, 1_000), 300_000);
      const record: StoredTicket = { claims, expiresAt: Date.now() + ttlMs };
      await this.ctx.storage.put(key(body.id), record);
      await this.ensureSweepAlarm();
      return Response.json({ ok: true });
    }

    if (url.pathname === "/take") {
      const body = (await request.json()) as { id?: unknown };
      if (typeof body.id !== "string") {
        return Response.json({ error: "invalid_request" }, { status: 400 });
      }
      const storageKey = key(body.id);
      const record = await this.ctx.storage.get<StoredTicket>(storageKey);
      if (!record) {
        return Response.json({ claims: null });
      }
      // No await between the read above and this delete:
      // the object's input gate guarantees no concurrent take.
      await this.ctx.storage.delete(storageKey);
      if (record.expiresAt <= Date.now()) {
        return Response.json({ claims: null });
      }
      return Response.json({ claims: record.claims });
    }

    if (url.pathname === "/count" && request.method === "POST") {
      const entries = await this.ctx.storage.list<StoredTicket>({ prefix: PREFIX });
      let live = 0;
      const now = Date.now();
      for (const value of entries.values()) {
        if (value.expiresAt > now) live += 1;
      }
      return Response.json({ live });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    let nextExpiry = Number.POSITIVE_INFINITY;
    const entries = await this.ctx.storage.list<StoredTicket>({ prefix: PREFIX });
    for (const [storageKey, value] of entries) {
      if (value.expiresAt <= now) {
        await this.ctx.storage.delete(storageKey);
      } else {
        nextExpiry = Math.min(nextExpiry, value.expiresAt);
      }
    }
    if (nextExpiry !== Number.POSITIVE_INFINITY) {
      await this.ctx.storage.setAlarm(nextExpiry + 1_000);
    }
  }

  private async ensureSweepAlarm(): Promise<void> {
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null) {
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
    }
  }
}

/**
 * TicketBackend backed by the vault Durable Object, so the ticket rules
 * (expiry, role binding, single use) stay in the tested TicketService.
 */
export class DurableObjectTicketBackend implements TicketBackend {
  private readonly namespace: DurableObjectNamespace;
  private readonly now: () => number;

  constructor(namespace: DurableObjectNamespace, now: () => number = Date.now) {
    this.namespace = namespace;
    this.now = now;
  }

  private stub(): DurableObjectStub {
    return this.namespace.get(this.namespace.idFromName("aether-ticket-vault"));
  }

  async put(id: string, claims: TicketClaims, ttlMs: number): Promise<void> {
    const response = await this.stub().fetch("https://vault/put", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, claims, ttlMs }),
    });
    if (!response.ok) {
      throw new Error(`Ticket vault rejected the write (${response.status})`);
    }
  }

  async take(id: string): Promise<TicketClaims | null> {
    const response = await this.stub().fetch("https://vault/take", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      throw new Error(`Ticket vault rejected the read (${response.status})`);
    }
    const payload = (await response.json()) as { claims: TicketClaims | null };
    return payload.claims ?? null;
  }
}
