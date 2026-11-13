import { AppError, errorResponse, json } from "./errors.ts";
import type { GitHubAppAuth, GitHubUser } from "./github.ts";
import type { BrokerConfig } from "./config.ts";
import type { Relay } from "./relay.ts";
import type { TicketService } from "./tickets.ts";

type UserVerifier = Pick<GitHubAppAuth, "verifyUserToken">;

export interface HandlerDeps {
  config: BrokerConfig;
  github: UserVerifier;
  tickets: TicketService;
  relay: Relay;
  fetchImpl?: typeof fetch;
  oidc?: (token: string) => Promise<Record<string, unknown>>;
  now?: () => number;
  version?: string;
}

const MAX_BODY_BYTES = 8 * 1024;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

interface RateBucket {
  windowStart: number;
  count: number;
}

export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  const now = deps.now ?? Date.now;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const version = deps.version ?? "0.1.0";
  const buckets = new Map<string, RateBucket>();

  function corsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get("origin");
    if (!origin) {
      return {};
    }
    if (!deps.config.allowedOrigins.includes(origin)) {
      return {};
    }
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-max-age": "600",
      vary: "origin",
    };
  }

  function guard(request: Request, limit = 30): void {
    const forwarded = request.headers.get("x-forwarded-for") ?? "";
    const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const bucket = buckets.get(ip);
    const current = now();
    if (!bucket || current - bucket.windowStart >= 60_000) {
      buckets.set(ip, { windowStart: current, count: 1 });
      return;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new AppError(429, "rate_limited", "Too many requests. Try again in a minute.");
    }
  }

  async function readJson(request: Request): Promise<Record<string, unknown>> {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      throw new AppError(413, "body_too_large", "Request body is too large.");
    }
    if (text.trim().length === 0) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new AppError(400, "invalid_json", "Request body must be a JSON object.");
    }
  }

  function bearer(request: Request): string {
    const header = request.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match?.[1]) {
      throw new AppError(401, "missing_token", "A bearer token is required.");
    }
    return match[1].trim();
  }

  function requireString(body: Record<string, unknown>, field: string, max = 512): string {
    const value = body[field];
    if (typeof value !== "string" || value.length === 0 || value.length > max) {
      throw new AppError(400, "invalid_field", `"${field}" is required.`);
    }
    return value;
  }

  function relayUrl(request: Request): string {
    const url = new URL(request.url);
    const scheme = url.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${url.host}/relay`;
  }

  async function githubForm(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AppError(503, "github_unreachable", "GitHub could not be reached.");
    }
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload) {
      throw new AppError(502, "github_bad_response", "GitHub returned an unreadable response.");
    }
    return payload;
  }

  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return json(
          200,
          {
            status: "ok",
            version,
            time: new Date(now()).toISOString(),
            relay: deps.relay.stats(),
          },
          cors,
        );
      }

      if (url.pathname === "/oauth/device/start" && request.method === "POST") {
        guard(request);
        const payload = await githubForm(GITHUB_DEVICE_CODE_URL, {
          client_id: deps.config.githubClientId,
          // GitHub Apps support only offline_access as a device-flow scope; it
          // yields an expiring user token plus a refresh token.
          scope: "offline_access",
        });
        if (typeof payload.device_code !== "string") {
          throw new AppError(502, "device_flow_failed", "GitHub did not return a device code.");
        }
        return json(
          200,
          {
            device_code: payload.device_code,
            user_code: payload.user_code,
            verification_uri: payload.verification_uri,
            expires_in: payload.expires_in,
            interval: payload.interval,
          },
          cors,
        );
      }

      if (url.pathname === "/oauth/device/poll" && request.method === "POST") {
        guard(request, 60);
        const body = await readJson(request);
        const deviceCode = requireString(body, "device_code");
        const payload = await githubForm(GITHUB_TOKEN_URL, {
          client_id: deps.config.githubClientId,
          device_code: deviceCode,
          grant_type: DEVICE_GRANT_TYPE,
        });
        return json(200, pickTokenFields(payload), cors);
      }

      if (url.pathname === "/oauth/refresh" && request.method === "POST") {
        guard(request);
        const body = await readJson(request);
        const refreshToken = requireString(body, "refresh_token", 2048);
        const payload = await githubForm(GITHUB_TOKEN_URL, {
          client_id: deps.config.githubClientId,
          client_secret: deps.config.githubClientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });
        return json(200, pickTokenFields(payload), cors);
      }

      if (url.pathname === "/ticket" && request.method === "POST") {
        guard(request);
        const userToken = bearer(request);
        const body = await readJson(request);
        const sessionId = requireString(body, "session_id", 64);
        if (!SESSION_ID_PATTERN.test(sessionId)) {
          throw new AppError(400, "invalid_session", "Session id is malformed.");
        }
        const user: GitHubUser = await deps.github.verifyUserToken(userToken);
        const repository = requireString(body, "repository", 200);
        if (repository !== deps.config.allowedRepository) {
          throw new AppError(
            403,
            "repository_not_allowed",
            "This broker is bound to a different repository.",
          );
        }
        const issued = await deps.tickets.issue(
          {
            sessionId,
            role: "app",
            userId: user.id,
            login: user.login,
            repository,
          },
          deps.config.ticketTtlMs,
        );
        return json(
          200,
          {
            ticket: issued.ticket,
            expires_at: new Date(issued.expiresAt).toISOString(),
            session_id: sessionId,
            role: "app",
            relay_url: relayUrl(request),
          },
          cors,
        );
      }

      if (url.pathname === "/worker/ticket" && request.method === "POST") {
        guard(request);
        if (!deps.oidc) {
          throw new AppError(503, "oidc_disabled", "Worker tickets are not configured.");
        }
        const oidcToken = bearer(request);
        const claims = await deps.oidc(oidcToken);
        const body = await readJson(request);
        const sessionId = requireString(body, "session_id", 64);
        if (!SESSION_ID_PATTERN.test(sessionId)) {
          throw new AppError(400, "invalid_session", "Session id is malformed.");
        }
        const repository = typeof claims.repository === "string" ? claims.repository : "";
        if (repository !== deps.config.allowedRepository) {
          throw new AppError(403, "repository_not_allowed", "OIDC token repository mismatch.");
        }
        const runId = typeof claims.run_id === "string" ? Number(claims.run_id) : undefined;
        const issued = await deps.tickets.issue(
          {
            sessionId,
            role: "worker",
            userId: 0,
            login: "github-actions",
            repository,
            runId: Number.isFinite(runId) ? runId : undefined,
          },
          deps.config.ticketTtlMs,
        );
        return json(
          200,
          {
            ticket: issued.ticket,
            expires_at: new Date(issued.expiresAt).toISOString(),
            session_id: sessionId,
            role: "worker",
            relay_url: relayUrl(request),
          },
          cors,
        );
      }

      return json(404, { error: { code: "not_found", message: "Unknown route." } }, cors);
    } catch (error) {
      const response = errorResponse(error);
      for (const [key, value] of Object.entries(cors)) {
        response.headers.set(key, value);
      }
      return response;
    }
  };
}

function pickTokenFields(payload: Record<string, unknown>): Record<string, unknown> {
  const fields = [
    "access_token",
    "token_type",
    "scope",
    "expires_in",
    "refresh_token",
    "refresh_token_expires_in",
    "error",
    "error_description",
    "error_uri",
    "interval",
  ];
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in payload) {
      out[field] = payload[field];
    }
  }
  return out;
}
