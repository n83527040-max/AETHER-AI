import type { Env } from "../env.ts";

interface Entry {
  app: number | null;
  worker: number | null;
  updatedAt: number;
}

const KEY = "sessions";
const STALE_AFTER_MS = 30 * 60_000;

/**
 * Small strongly-consistent counter object so `/health` reports real numbers.
 * Session objects report joins and leaves; entries older than 30 minutes are
 * pruned so a crashed isolate cannot inflate the totals forever.
 */
export class RelayRegistry implements DurableObject {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState, _env: Env) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/state") {
      const sessions = await this.load();
      let connections = 0;
      let live = 0;
      for (const entry of Object.values(sessions)) {
        let count = 0;
        if (entry.app !== null) count += 1;
        if (entry.worker !== null) count += 1;
        if (count > 0) live += 1;
        connections += count;
      }
      return Response.json({ sessions: live, connections });
    }

    if (url.pathname === "/event" && request.method === "POST") {
      const body = (await request.json()) as {
        session?: unknown;
        role?: unknown;
        event?: unknown;
      };
      if (
        typeof body.session !== "string" ||
        (body.role !== "app" && body.role !== "worker") ||
        (body.event !== "join" && body.event !== "leave")
      ) {
        return Response.json({ error: "invalid_request" }, { status: 400 });
      }
      const sessions = await this.load();
      const entry: Entry = sessions[body.session] ?? { app: null, worker: null, updatedAt: 0 };
      entry[body.role] = body.event === "join" ? Date.now() : null;
      entry.updatedAt = Date.now();
      sessions[body.session] = entry;
      await this.ctx.storage.put(KEY, sessions);
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  }

  private async load(): Promise<Record<string, Entry>> {
    const stored = (await this.ctx.storage.get<Record<string, Entry>>(KEY)) ?? {};
    const cutoff = Date.now() - STALE_AFTER_MS;
    const pruned: Record<string, Entry> = {};
    for (const [session, entry] of Object.entries(stored)) {
      if (entry.updatedAt >= cutoff) {
        pruned[session] = entry;
      }
    }
    return pruned;
  }
}
