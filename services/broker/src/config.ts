export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface BrokerConfig {
  githubClientId: string;
  githubClientSecret: string;
  githubAppId: string;
  githubAppPrivateKey: string;
  allowedRepository: string;
  relayAudience: string;
  ticketTtlMs: number;
  allowedOrigins: string[];
  githubApiBaseUrl: string;
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export function parseConfig(env: Record<string, string | undefined>): BrokerConfig {
  const allowedRepository = required(env, "AETHER_ALLOWED_REPOSITORY");
  if (!REPOSITORY_PATTERN.test(allowedRepository)) {
    throw new ConfigError("AETHER_ALLOWED_REPOSITORY must look like owner/name");
  }

  const privateKey = required(env, "AETHER_GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!privateKey.includes("PRIVATE KEY-----")) {
    throw new ConfigError("AETHER_GITHUB_APP_PRIVATE_KEY does not look like a PEM key");
  }

  const rawTtl = Number(env.AETHER_TICKET_TTL_MS ?? "60000");
  const ticketTtlMs = Number.isFinite(rawTtl) ? Math.min(Math.max(rawTtl, 15_000), 300_000) : 60_000;

  return {
    githubClientId: required(env, "AETHER_GITHUB_CLIENT_ID"),
    githubClientSecret: required(env, "AETHER_GITHUB_CLIENT_SECRET"),
    githubAppId: required(env, "AETHER_GITHUB_APP_ID"),
    githubAppPrivateKey: privateKey,
    allowedRepository,
    relayAudience: env.AETHER_RELAY_AUDIENCE?.trim() || "aether-relay",
    ticketTtlMs,
    allowedOrigins: (env.AETHER_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    githubApiBaseUrl: env.AETHER_GITHUB_API_BASE_URL?.trim() || "https://api.github.com",
  };
}
