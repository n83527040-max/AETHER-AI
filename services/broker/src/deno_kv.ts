import type { TicketBackend, TicketClaims } from "./tickets.ts";

interface KvEntry<T> {
  value: T | null;
}

export interface KvLike {
  get<T>(key: string[]): Promise<KvEntry<T> | null>;
  set(key: string[], value: unknown, options?: { expireIn?: number }): Promise<unknown>;
  atomic(): {
    check(...entries: unknown[]): {
      delete(key: string[]): { commit(): Promise<{ ok: boolean }> };
    };
  };
}

/** Single-use ticket storage that works across Deno Deploy isolates. */
export class KvTicketBackend implements TicketBackend {
  private readonly kv: KvLike;

  constructor(kv: KvLike) {
    this.kv = kv;
  }

  async put(id: string, claims: TicketClaims, ttlMs: number): Promise<void> {
    await this.kv.set(["tickets", id], claims, { expireIn: ttlMs });
  }

  async take(id: string): Promise<TicketClaims | null> {
    const key = ["tickets", id];
    const entry = await this.kv.get<TicketClaims>(key);
    if (!entry || !entry.value) {
      return null;
    }
    const committed = await this.kv
      .atomic()
      .check(entry)
      .delete(key)
      .commit();
    if (!committed.ok) {
      return null;
    }
    return entry.value;
  }
}
