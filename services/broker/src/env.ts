/**
 * Cloudflare bindings and configuration for the AETHER broker.
 *
 * Secret values (client secret, App private key) arrive only as encrypted
 * Worker secrets. They are never written to storage, logs, or responses.
 */
export interface Env {
  /** Single-use ticket vault (strongly consistent, alarm-based cleanup). */
  TICKETS: DurableObjectNamespace;
  /** One relay session per AETHER session id. */
  SESSIONS: DurableObjectNamespace;
  /** Live connection counters for `/health`. */
  REGISTRY: DurableObjectNamespace;

  AETHER_GITHUB_APP_ID: string;
  AETHER_GITHUB_CLIENT_ID: string;
  AETHER_GITHUB_CLIENT_SECRET: string;
  AETHER_GITHUB_APP_PRIVATE_KEY: string;
  AETHER_ALLOWED_REPOSITORY: string;

  AETHER_RELAY_AUDIENCE?: string;
  AETHER_TICKET_TTL_MS?: string;
  AETHER_ALLOWED_ORIGINS?: string;
  AETHER_GITHUB_API_BASE_URL?: string;
  AETHER_VERSION?: string;
}

/** Plain object view for the framework-agnostic config parser. */
export function envRecord(env: Env): Record<string, string | undefined> {
  return {
    AETHER_GITHUB_APP_ID: env.AETHER_GITHUB_APP_ID,
    AETHER_GITHUB_CLIENT_ID: env.AETHER_GITHUB_CLIENT_ID,
    AETHER_GITHUB_CLIENT_SECRET: env.AETHER_GITHUB_CLIENT_SECRET,
    AETHER_GITHUB_APP_PRIVATE_KEY: env.AETHER_GITHUB_APP_PRIVATE_KEY,
    AETHER_ALLOWED_REPOSITORY: env.AETHER_ALLOWED_REPOSITORY,
    AETHER_RELAY_AUDIENCE: env.AETHER_RELAY_AUDIENCE,
    AETHER_TICKET_TTL_MS: env.AETHER_TICKET_TTL_MS,
    AETHER_ALLOWED_ORIGINS: env.AETHER_ALLOWED_ORIGINS,
    AETHER_GITHUB_API_BASE_URL: env.AETHER_GITHUB_API_BASE_URL,
  };
}

export interface RelayStats {
  sessions: number;
  connections: number;
}
