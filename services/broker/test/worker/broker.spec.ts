import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const VAULT = "aether-ticket-vault";
const REPOSITORY = "n83527040-max/AETHER-AI";

interface Claims {
  sessionId: string;
  role: "app" | "worker";
  userId: number;
  login: string;
  repository: string;
  expiresAt: number;
}

function vault() {
  return env.TICKETS.get(env.TICKETS.idFromName(VAULT));
}

async function putTicket(id: string, overrides: Partial<Claims> = {}): Promise<Claims> {
  const claims: Claims = {
    sessionId: "session-abcdefghijklmnop",
    role: "app",
    userId: 1,
    login: "octocat",
    repository: REPOSITORY,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
  const response = await vault().fetch("https://vault/put", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, claims, ttlMs: 60_000 }),
  });
  expect(response.status).toBe(200);
  return claims;
}

async function takeTicket(id: string): Promise<Claims | null> {
  const response = await vault().fetch("https://vault/take", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { claims: Claims | null }).claims;
}

async function connect(ticket: string): Promise<WebSocket> {
  const response = await SELF.fetch(`https://broker.example/relay?ticket=${encodeURIComponent(ticket)}`, {
    headers: { upgrade: "websocket" },
  });
  if (!response.webSocket) {
    throw new Error(`relay upgrade failed with ${response.status}`);
  }
  const socket = response.webSocket;
  socket.accept();
  return socket;
}

function nextMessage(socket: WebSocket, timeoutMs = 2_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for a frame")), timeoutMs);
    socket.addEventListener("message", (event) => {
      clearTimeout(timer);
      resolve(String(event.data));
    }, { once: true });
  });
}

describe("health", () => {
  it("reports a configured Cloudflare runtime", async () => {
    const response = await SELF.fetch("https://broker.example/health");
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.runtime).toBe("cloudflare-workers");
    expect(body.config).toBe("ok");
    expect(body.repository).toBe(REPOSITORY);
    expect(body.tickets).toBe("durable-object");
    expect(body.relay).toEqual({ sessions: 0, connections: 0 });
  });
});

describe("ticket vault", () => {
  it("hands a ticket to exactly one of ten concurrent callers", async () => {
    await putTicket("concurrent-ticket-0000001");
    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => takeTicket("concurrent-ticket-0000001")),
    );
    const winners = outcomes.filter((claims) => claims !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.login).toBe("octocat");
  });

  it("returns null for an unknown ticket", async () => {
    expect(await takeTicket("does-not-exist-000000000")).toBeNull();
  });

  it("does not resurrect a consumed ticket", async () => {
    await putTicket("reuse-ticket-00000000001");
    expect(await takeTicket("reuse-ticket-00000000001")).not.toBeNull();
    expect(await takeTicket("reuse-ticket-00000000001")).toBeNull();
  });
});

describe("relay", () => {
  it("rejects a missing or spent ticket", async () => {
    const missing = await SELF.fetch("https://broker.example/relay", { headers: { upgrade: "websocket" } });
    expect(missing.status).toBe(401);

    await putTicket("spent-ticket-000000000001");
    expect(await takeTicket("spent-ticket-000000000001")).not.toBeNull();
    const replay = await SELF.fetch(
      "https://broker.example/relay?ticket=spent-ticket-000000000001",
      { headers: { upgrade: "websocket" } },
    );
    expect(replay.status).toBe(401);
  });

  it("forwards frames between the app and the worker only", async () => {
    await putTicket("relay-app-ticket-00000001", { role: "app" });
    await putTicket("relay-worker-ticket-0000001", {
      role: "worker",
      userId: 0,
      login: "github-actions",
    });

    const app = await connect("relay-app-ticket-00000001");
    const worker = await connect("relay-worker-ticket-0000001");

    const received = nextMessage(worker);
    app.send('{"type":"prompt","text":"hello"}');
    expect(await received).toBe('{"type":"prompt","text":"hello"}');

    const back = nextMessage(app);
    worker.send('{"type":"event","name":"ready"}');
    expect(await back).toBe('{"type":"event","name":"ready"}');

    app.close();
    worker.close();
  });

  it("binds a session to one repository", async () => {
    await putTicket("bind-app-ticket-000000000001", { role: "app" });
    const app = await connect("bind-app-ticket-000000000001");

    await putTicket("bind-worker-ticket-0000000001", {
      role: "worker",
      repository: "someone/else",
      login: "github-actions",
      userId: 0,
    });
    const response = await SELF.fetch(
      "https://broker.example/relay?ticket=bind-worker-ticket-0000000001",
      { headers: { upgrade: "websocket" } },
    );
    expect(response.status).toBe(403);
    app.close();
  });

  it("closes the previous socket when a role reconnects", async () => {
    await putTicket("replace-app-ticket-0000000001", { role: "app" });
    const first = await connect("replace-app-ticket-0000000001");
    const closed = new Promise<number>((resolve) => {
      first.addEventListener("close", (event) => resolve((event as CloseEvent).code));
    });

    await putTicket("replace-app-ticket-0000000002", { role: "app" });
    const second = await connect("replace-app-ticket-0000000002");
    expect(await closed).toBe(4001);
    second.close();
  });
});
