import type { TicketClaims, TicketRole } from "./tickets.ts";

export interface RelaySocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface RelayLimits {
  maxFrameBytes: number;
  messagesPerSecond: number;
  staleAfterMs: number;
}

export const DEFAULT_LIMITS: RelayLimits = {
  maxFrameBytes: 256 * 1024,
  messagesPerSecond: 60,
  staleAfterMs: 45_000,
};

interface Connection {
  socket: RelaySocket;
  windowStart: number;
  count: number;
}

interface Session {
  app?: Connection;
  worker?: Connection;
  lastSeen: number;
}

export type RelayResult =
  | { ok: true; forwarded: boolean }
  | { ok: false; reason: "too_large" | "rate_limited" | "not_joined" | "invalid" };

/**
 * A dumb, symmetric frame forwarder. It never inspects or stores payloads.
 * The two roles in a session may only talk to each other.
 */
export class Relay {
  private readonly sessions = new Map<string, Session>();
  private readonly limits: RelayLimits;

  constructor(limits: RelayLimits = DEFAULT_LIMITS) {
    this.limits = limits;
  }

  attach(claims: TicketClaims, socket: RelaySocket, now = Date.now()): void {
    let session = this.sessions.get(claims.sessionId);
    if (!session) {
      session = { lastSeen: now };
      this.sessions.set(claims.sessionId, session);
    }
    const existing = session[claims.role];
    if (existing) {
      existing.socket.close(4001, "replaced");
    }
    session[claims.role] = { socket, windowStart: now, count: 0 };
    session.lastSeen = now;
  }

  detach(sessionId: string, role: TicketRole, socket: RelaySocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session[role]?.socket === socket) {
      delete session[role];
    }
    if (!session.app && !session.worker) {
      this.sessions.delete(sessionId);
    }
  }

  receive(
    claims: TicketClaims,
    socket: RelaySocket,
    data: string,
    now = Date.now(),
  ): RelayResult {
    const session = this.sessions.get(claims.sessionId);
    const connection = session?.[claims.role];
    if (!session || !connection || connection.socket !== socket) {
      return { ok: false, reason: "not_joined" };
    }

    if (typeof data !== "string" || data.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    if (data.length > this.limits.maxFrameBytes) {
      socket.close(1009, "frame too large");
      return { ok: false, reason: "too_large" };
    }

    if (now - connection.windowStart >= 1000) {
      connection.windowStart = now;
      connection.count = 0;
    }
    connection.count += 1;
    if (connection.count > this.limits.messagesPerSecond) {
      socket.close(1008, "rate limited");
      return { ok: false, reason: "rate_limited" };
    }

    session.lastSeen = now;
    const peerRole: TicketRole = claims.role === "app" ? "worker" : "app";
    const peer = session[peerRole];
    if (!peer) {
      return { ok: true, forwarded: false };
    }
    try {
      peer.socket.send(data);
      return { ok: true, forwarded: true };
    } catch {
      peer.socket.close(1011, "peer send failed");
      return { ok: true, forwarded: false };
    }
  }

  /** Closes connections that have been silent for too long. */
  sweep(now = Date.now()): number {
    let closed = 0;
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastSeen <= this.limits.staleAfterMs) {
        continue;
      }
      for (const role of ["app", "worker"] as const) {
        const connection = session[role];
        if (connection) {
          try {
            connection.socket.close(4000, "heartbeat timeout");
          } catch {
            // already closed
          }
          closed += 1;
        }
      }
      this.sessions.delete(sessionId);
    }
    return closed;
  }

  heartbeat(sessionId: string, now = Date.now()): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastSeen = now;
    }
  }

  stats(): { sessions: number; connections: number } {
    let connections = 0;
    for (const session of this.sessions.values()) {
      if (session.app) connections += 1;
      if (session.worker) connections += 1;
    }
    return { sessions: this.sessions.size, connections };
  }
}
