import { importRsaKeyFromJwk, verifyJwt, type JwtHeader } from "./jwt.ts";

export const ACTIONS_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const DEFAULT_JWKS_URL = `${ACTIONS_OIDC_ISSUER}/.well-known/jwks`;

interface JwksCacheEntry {
  keys: JsonWebKey[];
  fetchedAt: number;
}

let jwksCache: JwksCacheEntry | null = null;

export interface ActionsOidcOptions {
  audience: string;
  allowedRepository: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  jwks?: JsonWebKey[];
  jwksUrl?: string;
}

export class OidcError extends Error {
  readonly code: "invalid" | "unavailable" | "unauthorized";

  constructor(message: string, code: "invalid" | "unavailable" | "unauthorized") {
    super(message);
    this.name = "OidcError";
    this.code = code;
  }
}

async function loadJwks(
  url: string,
  fetchImpl: typeof fetch,
  now: () => number,
): Promise<JsonWebKey[]> {
  if (jwksCache && now() - jwksCache.fetchedAt < 3_600_000) {
    return jwksCache.keys;
  }
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(5_000) });
  } catch {
    throw new OidcError("Could not reach the Actions OIDC key set", "unavailable");
  }
  if (!response.ok) {
    throw new OidcError("Actions OIDC key set request failed", "unavailable");
  }
  const payload = (await response.json()) as { keys?: JsonWebKey[] };
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new OidcError("Actions OIDC key set was empty", "unavailable");
  }
  jwksCache = { keys: payload.keys, fetchedAt: now() };
  return payload.keys;
}

function audienceMatches(audience: unknown, expected: string): boolean {
  if (typeof audience === "string") {
    return audience === expected;
  }
  if (Array.isArray(audience)) {
    return audience.includes(expected);
  }
  return false;
}

/**
 * Verifies the OIDC token that a GitHub Actions job can request with
 * `permissions: id-token: write`. This lets the worker prove which repository
 * and run it belongs to without any long-lived shared secret.
 */
export async function verifyActionsOidc(
  token: string,
  options: ActionsOidcOptions,
): Promise<Record<string, unknown>> {
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = options.jwksUrl ?? DEFAULT_JWKS_URL;
  const keys = options.jwks ?? (await loadJwks(url, fetchImpl, now));

  const headerSegment = token.split(".")[0];
  if (!headerSegment) {
    throw new OidcError("OIDC token is malformed", "invalid");
  }
  let headerKid: string | undefined;
  try {
    const header = JSON.parse(
      atob(headerSegment.replace(/-/g, "+").replace(/_/g, "/")),
    ) as JwtHeader;
    headerKid = header.kid;
  } catch {
    throw new OidcError("OIDC token header is malformed", "invalid");
  }

  const candidates = headerKid
    ? keys.filter((key) => (key as JsonWebKey & { kid?: string }).kid === headerKid)
    : keys;
  if (candidates.length === 0) {
    throw new OidcError("No matching OIDC signing key", "unauthorized");
  }

  let claims: Record<string, unknown> | null = null;
  for (const jwk of candidates) {
    try {
      const key = await importRsaKeyFromJwk(jwk);
      claims = await verifyJwt(token, key, "RS256", { now, clockSkewSeconds: 30 });
      break;
    } catch {
      // try the next key
    }
  }
  if (!claims) {
    throw new OidcError("OIDC signature could not be verified", "unauthorized");
  }

  if (claims.iss !== ACTIONS_OIDC_ISSUER) {
    throw new OidcError("Unexpected OIDC issuer", "unauthorized");
  }
  if (!audienceMatches(claims.aud, options.audience)) {
    throw new OidcError("Unexpected OIDC audience", "unauthorized");
  }
  if (claims.repository !== options.allowedRepository) {
    throw new OidcError("OIDC token belongs to a different repository", "unauthorized");
  }
  return claims;
}
