import { ConfigError, parseConfig, type BrokerConfig } from "./config.ts";
import { envRecord, type Env } from "./env.ts";
import { AppError, json } from "./errors.ts";
import { GitHubAppAuth } from "./github.ts";
import { createHandler } from "./http.ts";
import { verifyActionsOidc } from "./oidc.ts";
import { TicketService } from "./tickets.ts";
import { DurableObjectTicketBackend } from "./store/ticket_vault.ts";
import { encodeClaims } from "./store/relay_session.ts";

export { TicketVault } from "./store/ticket_vault.ts";
export { RelaySession } from "./store/relay_session.ts";
export { RelayRegistry } from "./store/registry.ts";

const TICKET_VAULT_NAME = "aether-ticket-vault";
const REGISTRY_NAME = "aether-relay-registry";

interface Runtime {
  config: BrokerConfig;
  tickets: TicketService;
  handler: (request: Request) => Promise<Response>;
}

/** Per-isolate cache: config parsing and key import happen once, not per request. */
let runtimePromise: Promise<Runtime> | null = null;
let runtimeKey = "";

function runtimeKeyFor(env: Env): string {
  return [env.AETHER_GITHUB_APP_ID, env.AETHER_GITHUB_CLIENT_ID, env.AETHER_ALLOWED_REPOSITORY]
    .join("|");
}

function getRuntime(env: Env): Promise<Runtime> {
  const key = runtimeKeyFor(env);
  if (runtimePromise && runtimeKey === key) {
    return runtimePromise;
  }
  runtimeKey = key;
  const built = buildRuntime(env).catch((error: unknown) => {
    runtimePromise = null;
    throw error;
  });
  runtimePromise = built;
  return built;
}

async function buildRuntime(env: Env): Promise<Runtime> {
  const config = parseConfig(envRecord(env));
  const github = await GitHubAppAuth.create({
    appId: config.githubAppId,
    privateKeyPem: config.githubAppPrivateKey,
    apiBaseUrl: config.githubApiBaseUrl,
  });
  const tickets = new TicketService(new DurableObjectTicketBackend(env.TICKETS));
  const handler = createHandler({
    config,
    github,
    tickets,
    stats: () => relayStats(env),
    oidc: (token: string) =>
      verifyActionsOidc(token, {
        audience: config.relayAudience,
        allowedRepository: config.allowedRepository,
      }),
    version: env.AETHER_VERSION?.trim() || "0.1.0",
  });
  return { config, tickets, handler };
}

async function relayStats(env: Env): Promise<{ sessions: number; connections: number }> {
  try {
    const stub = env.REGISTRY.get(env.REGISTRY.idFromName(REGISTRY_NAME));
    const response = await stub.fetch("https://registry/state");
    if (!response.ok) {
      return { sessions: 0, connections: 0 };
    }
    const payload = (await response.json()) as { sessions?: number; connections?: number };
    return {
      sessions: typeof payload.sessions === "number" ? payload.sessions : 0,
      connections: typeof payload.connections === "number" ? payload.connections : 0,
    };
  } catch {
    return { sessions: 0, connections: 0 };
  }
}

async function health(env: Env): Promise<Response> {
  const base = {
    runtime: "cloudflare-workers",
    version: env.AETHER_VERSION?.trim() || "0.1.0",
    time: new Date().toISOString(),
    repository: env.AETHER_ALLOWED_REPOSITORY ?? null,
    tickets: "durable-object",
    relayTransport: "durable-object-websocket",
  };
  try {
    await getRuntime(env);
  } catch (error) {
    const message = error instanceof ConfigError ? error.message : "Configuration is invalid";
    return json(503, {
      ...base,
      status: "degraded",
      config: "invalid",
      error: { code: "config_error", message },
      relay: { sessions: 0, connections: 0 },
    });
  }
  return json(200, {
    ...base,
    status: "ok",
    config: "ok",
    relay: await relayStats(env),
  });
}

async function handleRelay(request: Request, env: Env, runtime: Runtime): Promise<Response> {
  const url = new URL(request.url);
  if ((request.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
    return json(426, {
      error: { code: "upgrade_required", message: "Expected a WebSocket upgrade." },
    });
  }
  const ticket = url.searchParams.get("ticket");
  if (!ticket) {
    return json(401, { error: { code: "missing_ticket", message: "A ticket is required." } });
  }
  const claims = await runtime.tickets.consume(ticket);
  if (!claims) {
    return json(401, {
      error: { code: "invalid_ticket", message: "This ticket is invalid, expired, or already used." },
    });
  }

  const stub = env.SESSIONS.get(env.SESSIONS.idFromName(claims.sessionId));
  return stub.fetch(
    new Request("https://session/join", {
      headers: {
        upgrade: "websocket",
        "x-aether-claims": encodeClaims(claims),
      },
    }),
  );
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return health(env);
    }

    let runtime: Runtime;
    try {
      runtime = await getRuntime(env);
    } catch (error) {
      if (error instanceof ConfigError) {
        return json(503, { error: { code: "config_error", message: error.message } });
      }
      if (error instanceof AppError) {
        return json(error.status, { error: { code: error.code, message: error.message } });
      }
      throw error;
    }

    if (url.pathname === "/relay") {
      return handleRelay(request, env, runtime);
    }
    return runtime.handler(request);
  },
} satisfies ExportedHandler<Env>;
