import assert from "node:assert/strict";
import test from "node:test";

import type { BrokerConfig } from "../src/config.ts";
import { createHandler } from "../src/http.ts";
import { InMemoryTicketBackend, TicketService } from "../src/tickets.ts";

const config: BrokerConfig = {
  githubClientId: "Iv1.testclientid",
  githubClientSecret: "secret-value",
  githubAppId: "123456",
  githubAppPrivateKey: "unused-in-http-tests",
  allowedRepository: "owner/repo",
  relayAudience: "aether-relay",
  ticketTtlMs: 60_000,
  allowedOrigins: ["https://app.example"],
  githubApiBaseUrl: "https://api.github.com",
};

function build(overrides: { fetchImpl?: typeof fetch; oidc?: boolean } = {}) {
  const tickets = new TicketService(new InMemoryTicketBackend());
  const handler = createHandler({
    config,
    github: {
      verifyUserToken: async () => ({ id: 7, login: "octocat", avatarUrl: null }),
    },
    tickets,
    stats: () => ({ sessions: 0, connections: 0 }),
    fetchImpl: overrides.fetchImpl ?? (fetch as typeof fetch),
    oidc: overrides.oidc
      ? async () => ({ repository: "owner/repo", run_id: "99" })
      : undefined,
    now: () => 1_700_000_000_000,
  });
  return { handler, tickets };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://broker.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("health reports relay statistics", async () => {
  const { handler } = build();
  const response = await handler(new Request("https://broker.example/health"));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { status: string; relay: { sessions: number } };
  assert.equal(body.status, "ok");
  assert.equal(body.relay.sessions, 0);
});

test("device start proxies GitHub and never returns extra fields", async () => {
  let capturedBody = "";
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = String(init?.body ?? "");
    return new Response(
      JSON.stringify({
        device_code: "device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
        secret_extra: "must-not-leak",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;

  const { handler } = build({ fetchImpl });
  const response = await handler(post("/oauth/device/start", {}));
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.device_code, "device-code");
  assert.equal(body.secret_extra, undefined);
  assert.match(capturedBody, /client_id=Iv1\.testclientid/);
  assert.doesNotMatch(capturedBody, /secret-value/);
});

test("device polling forwards GitHub errors without inventing success", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: "authorization_pending" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
  const { handler } = build({ fetchImpl });
  const response = await handler(post("/oauth/device/poll", { device_code: "dc" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { error: "authorization_pending" });
});

test("ticket issuance requires a bearer token", async () => {
  const { handler } = build();
  const response = await handler(post("/ticket", { session_id: "session-1234567890", repository: "owner/repo" }));
  assert.equal(response.status, 401);
});

test("ticket issuance rejects a foreign repository", async () => {
  const { handler } = build();
  const response = await handler(
    post(
      "/ticket",
      { session_id: "session-1234567890", repository: "attacker/repo" },
      { authorization: "Bearer ghu_abcdefghijklmnopqrstuvwxyz" },
    ),
  );
  assert.equal(response.status, 403);
});

test("a valid request issues a single-use app ticket", async () => {
  const { handler, tickets } = build();
  const response = await handler(
    post(
      "/ticket",
      { session_id: "session-1234567890", repository: "owner/repo" },
      { authorization: "Bearer ghu_abcdefghijklmnopqrstuvwxyz" },
    ),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { ticket: string; relay_url: string; role: string };
  assert.equal(body.role, "app");
  assert.equal(body.relay_url, "wss://broker.example/relay");
  const claims = await tickets.consume(body.ticket, "app");
  assert.equal(claims?.login, "octocat");
  assert.equal(claims?.sessionId, "session-1234567890");
});

test("worker tickets are unavailable unless OIDC is configured", async () => {
  const { handler } = build();
  const response = await handler(
    post(
      "/worker/ticket",
      { session_id: "session-1234567890" },
      { authorization: "Bearer oidc" },
    ),
  );
  assert.equal(response.status, 503);
});

test("worker tickets are issued from verified OIDC claims", async () => {
  const { handler, tickets } = build({ oidc: true });
  const response = await handler(
    post(
      "/worker/ticket",
      { session_id: "session-1234567890" },
      { authorization: "Bearer oidc" },
    ),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { ticket: string };
  const claims = await tickets.consume(body.ticket, "worker");
  assert.equal(claims?.runId, 99);
  assert.equal(claims?.role, "worker");
});

test("unknown routes return a structured 404", async () => {
  const { handler } = build();
  const response = await handler(new Request("https://broker.example/nope"));
  assert.equal(response.status, 404);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "not_found");
});
