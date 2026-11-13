import { GitHubError } from "./github.ts";
import { OidcError } from "./oidc.ts";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json(error.status, { error: { code: error.code, message: error.message } });
  }
  // A rejected GitHub credential is an authentication failure for this API,
  // not a broker fault. Anything else from GitHub is an upstream failure.
  if (error instanceof GitHubError) {
    const rejected = error.status === 401 || error.status === 403;
    return json(rejected ? 401 : 502, {
      error: {
        code: rejected ? "github_token_rejected" : "github_error",
        message: rejected
          ? "GitHub rejected this token. Sign in again."
          : "GitHub could not verify the token right now.",
      },
    });
  }
  if (error instanceof OidcError) {
    const unavailable = error.code === "unavailable";
    return json(unavailable ? 503 : 401, {
      error: {
        code: `oidc_${error.code}`,
        message: unavailable
          ? "GitHub's OIDC keys could not be reached."
          : "The OIDC token is not valid for this broker.",
      },
    });
  }
  return json(500, {
    error: { code: "internal_error", message: "The broker could not complete the request." },
  });
}
