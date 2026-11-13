import assert from "node:assert/strict";
import test from "node:test";

import { Relay } from "../src/relay.ts";
import type { TicketClaims } from "../src/tickets.ts";

class FakeSocket {
  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;

  send(data: string): void {
    if (this.closed) {
      throw new Error("closed");
    }
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }
}

function claims(role: "app" | "worker", sessionId = "session-abcdefghijklmnop"): TicketClaims {
  return {
    sessionId,
    role,
    userId: role === "app" ? 1 : 0,
    login: role,
    repository: "owner/repo",
    expiresAt: Date.now() + 60_000,
  };
}

test("frames are forwarded only to the opposite role", () => {
  const relay = new Relay();
  const app = new FakeSocket();
  const worker = new FakeSocket();
  relay.attach(claims("app"), app);
  relay.attach(claims("worker"), worker);

  const result = relay.receive(claims("app"), app, '{"type":"prompt"}');
  assert.deepEqual(result, { ok: true, forwarded: true });
  assert.deepEqual(worker.sent, ['{"type":"prompt"}']);
  assert.deepEqual(app.sent, []);

  relay.receive(claims("worker"), worker, '{"type":"event"}');
  assert.deepEqual(app.sent, ['{"type":"event"}']);
});

test("a missing peer drops the frame without failing", () => {
  const relay = new Relay();
  const app = new FakeSocket();
  relay.attach(claims("app"), app);
  const result = relay.receive(claims("app"), app, "hello");
  assert.deepEqual(result, { ok: true, forwarded: false });
});

test("oversized frames close the socket", () => {
  const relay = new Relay({ maxFrameBytes: 8, messagesPerSecond: 100, staleAfterMs: 1000 });
  const app = new FakeSocket();
  relay.attach(claims("app"), app);
  const result = relay.receive(claims("app"), app, "x".repeat(9));
  assert.equal(result.ok, false);
  assert.equal(app.closed?.code, 1009);
});

test("rate limiting closes an abusive socket", () => {
  const relay = new Relay({ maxFrameBytes: 1024, messagesPerSecond: 2, staleAfterMs: 1000 });
  const app = new FakeSocket();
  const now = 1_000_000;
  relay.attach(claims("app"), app, now);
  assert.equal(relay.receive(claims("app"), app, "a", now).ok, true);
  assert.equal(relay.receive(claims("app"), app, "b", now).ok, true);
  const limited = relay.receive(claims("app"), app, "c", now);
  assert.equal(limited.ok, false);
  assert.equal(app.closed?.code, 1008);
});

test("replacing a role closes the previous socket", () => {
  const relay = new Relay();
  const first = new FakeSocket();
  const second = new FakeSocket();
  relay.attach(claims("app"), first);
  relay.attach(claims("app"), second);
  assert.equal(first.closed?.code, 4001);
});

test("detach cleans up empty sessions and sweep reaps silent ones", () => {
  const relay = new Relay({ maxFrameBytes: 1024, messagesPerSecond: 10, staleAfterMs: 1000 });
  const app = new FakeSocket();
  const worker = new FakeSocket();
  const now = 5_000_000;
  relay.attach(claims("app"), app, now);
  relay.attach(claims("worker"), worker, now);
  assert.equal(relay.stats().sessions, 1);
  assert.equal(relay.stats().connections, 2);

  relay.detach("session-abcdefghijklmnop", "app", app);
  assert.equal(relay.stats().connections, 1);
  relay.detach("session-abcdefghijklmnop", "worker", worker);
  assert.equal(relay.stats().sessions, 0);

  relay.attach(claims("app"), app, now);
  assert.equal(relay.sweep(now + 5000), 1);
  assert.equal(app.closed?.code, 4000);
  assert.equal(relay.stats().sessions, 0);
});
