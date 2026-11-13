import { bytesToBase64Url } from "./base64url.ts";

export type TicketRole = "app" | "worker";

export interface TicketClaims {
  sessionId: string;
  role: TicketRole;
  userId: number;
  login: string;
  repository: string;
  runId?: number;
  expiresAt: number;
}

export interface TicketBackend {
  put(id: string, claims: TicketClaims, ttlMs: number): Promise<void>;
  /** Atomically removes and returns a ticket. A second call must return null. */
  take(id: string): Promise<TicketClaims | null>;
}

export class InMemoryTicketBackend implements TicketBackend {
  private readonly entries = new Map<string, { claims: TicketClaims; expiresAt: number }>();

  async put(id: string, claims: TicketClaims, ttlMs: number): Promise<void> {
    this.entries.set(id, { claims, expiresAt: Date.now() + ttlMs });
  }

  async take(id: string): Promise<TicketClaims | null> {
    const entry = this.entries.get(id);
    if (!entry) {
      return null;
    }
    this.entries.delete(id);
    if (entry.expiresAt <= Date.now()) {
      return null;
    }
    return entry.claims;
  }

  get size(): number {
    return this.entries.size;
  }
}

export class TicketService {
  private readonly backend: TicketBackend;
  private readonly now: () => number;
  private readonly generateId: () => string;

  constructor(
    backend: TicketBackend,
    now: () => number = Date.now,
    generateId: () => string = defaultId,
  ) {
    this.backend = backend;
    this.now = now;
    this.generateId = generateId;
  }

  async issue(
    claims: Omit<TicketClaims, "expiresAt">,
    ttlMs = 60_000,
  ): Promise<{ ticket: string; expiresAt: number }> {
    const id = this.generateId();
    const expiresAt = this.now() + ttlMs;
    await this.backend.put(id, { ...claims, expiresAt }, ttlMs);
    return { ticket: id, expiresAt };
  }

  async consume(id: string, expectedRole?: TicketRole): Promise<TicketClaims | null> {
    if (!/^[A-Za-z0-9_-]{20,120}$/.test(id)) {
      return null;
    }
    const claims = await this.backend.take(id);
    if (!claims) {
      return null;
    }
    if (claims.expiresAt <= this.now()) {
      return null;
    }
    if (expectedRole && claims.role !== expectedRole) {
      return null;
    }
    return claims;
  }
}

function defaultId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}
