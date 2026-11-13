import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryTicketBackend, TicketService } from "../src/tickets.ts";

function service(now: () => number) {
  let counter = 0;
  return new TicketService(
    new InMemoryTicketBackend(),
    now,
    () => `ticket-${String(++counter).padStart(24, "0")}`,
  );
}

test("a ticket can be consumed exactly once", async () => {
  const tickets = service(() => 1_000_000);
  const issued = await tickets.issue({
    sessionId: "session-1234567890",
    role: "app",
    userId: 5,
    login: "octocat",
    repository: "owner/repo",
  });

  const first = await tickets.consume(issued.ticket, "app");
  assert.equal(first?.userId, 5);

  const second = await tickets.consume(issued.ticket, "app");
  assert.equal(second, null);
});

test("role mismatch does not yield a usable ticket", async () => {
  const tickets = service(() => 1_000_000);
  const issued = await tickets.issue({
    sessionId: "session-1234567890",
    role: "app",
    userId: 5,
    login: "octocat",
    repository: "owner/repo",
  });
  const consumed = await tickets.consume(issued.ticket, "worker");
  assert.equal(consumed, null);
});

test("expired tickets are rejected", async () => {
  let now = 1_000_000;
  const tickets = service(() => now);
  const issued = await tickets.issue(
    {
      sessionId: "session-1234567890",
      role: "worker",
      userId: 0,
      login: "github-actions",
      repository: "owner/repo",
    },
    1000,
  );
  now += 5000;
  assert.equal(await tickets.consume(issued.ticket), null);
});

test("malformed ticket ids are rejected without a backend lookup", async () => {
  const tickets = service(() => 1_000_000);
  assert.equal(await tickets.consume("short"), null);
  assert.equal(await tickets.consume("../../etc/passwd"), null);
});
