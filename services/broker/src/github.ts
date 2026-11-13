import { base64UrlToBytes, bufferSource, concatBytes, fromUtf8, utf8 } from "./base64url.ts";
import { signJwt } from "./jwt.ts";

export class GitHubError extends Error {
  readonly status: number;
  readonly detail: string | undefined;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.detail = detail;
  }
}

export interface GitHubUser {
  id: number;
  login: string;
  avatarUrl: string | null;
}

export interface InstallationToken {
  token: string;
  expiresAt: number;
}

export interface GitHubAppAuthOptions {
  appId: string;
  privateKeyPem: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  apiBaseUrl?: string;
}

/* ------------------------------------------------------------------ *
 * PEM / DER helpers
 *
 * GitHub App private keys are usually PKCS#1 ("BEGIN RSA PRIVATE KEY")
 * but are increasingly PKCS#8. WebCrypto only imports PKCS#8, so a
 * PKCS#1 key is wrapped in a minimal PKCS#8 envelope.
 * ------------------------------------------------------------------ */

function derLength(length: number): number[] {
  if (length < 0x80) {
    return [length];
  }
  if (length < 0x100) {
    return [0x81, length];
  }
  if (length < 0x10000) {
    return [0x82, (length >> 8) & 0xff, length & 0xff];
  }
  throw new Error("DER length too large");
}

function der(tag: number, content: Uint8Array): Uint8Array {
  return concatBytes(
    new Uint8Array([tag]),
    new Uint8Array(derLength(content.length)),
    content,
  );
}

const RSA_ALGORITHM_IDENTIFIER = new Uint8Array([
  0x30, 0x0d,
  0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
  0x05, 0x00,
]);

export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  return der(
    0x30,
    concatBytes(
      version,
      RSA_ALGORITHM_IDENTIFIER,
      der(0x04, pkcs1),
    ),
  );
}

function pemBody(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (base64.length === 0) {
    throw new Error("Private key PEM is empty");
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  if (pem.includes("ENCRYPTED PRIVATE KEY")) {
    throw new Error("Encrypted private keys are not supported; provide an unencrypted PKCS#1 or PKCS#8 key");
  }
  const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  const body = pemBody(pem);
  const pkcs8 = isPkcs1 ? pkcs1ToPkcs8(body) : body;
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      bufferSource(pkcs8),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not import the GitHub App private key: ${message}`);
  }
}

/* ------------------------------------------------------------------ */

const API_VERSION = "2022-11-28";

export class GitHubAppAuth {
  private readonly appId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly apiBaseUrl: string;
  private readonly keyPromise: Promise<CryptoKey>;
  private readonly tokenCache = new Map<number, InstallationToken>();

  private constructor(options: GitHubAppAuthOptions) {
    this.appId = options.appId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/+$/, "");
    this.keyPromise = importPrivateKey(options.privateKeyPem);
  }

  static async create(options: GitHubAppAuthOptions): Promise<GitHubAppAuth> {
    const auth = new GitHubAppAuth(options);
    await auth.keyPromise.catch(() => undefined);
    return auth;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
    return response;
  }

  /** RS256 app JWT. GitHub rejects lifetimes over 10 minutes. */
  async appJwt(): Promise<string> {
    const key = await this.keyPromise;
    const issuedAt = Math.floor(this.now() / 1000) - 60;
    const expiresAt = Math.floor(this.now() / 1000) + 540;
    return signJwt({ iat: issuedAt, exp: expiresAt, iss: this.appId }, key, "RS256");
  }

  async installationToken(
    installationId: number,
    repositoryIds?: number[],
  ): Promise<InstallationToken> {
    const cached = this.tokenCache.get(installationId);
    if (cached && cached.expiresAt - 300_000 > this.now()) {
      return cached;
    }
    const jwt = await this.appJwt();
    const body: Record<string, unknown> = {};
    if (repositoryIds && repositoryIds.length > 0) {
      body.repository_ids = repositoryIds;
    }
    const response = await this.request(
      `/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (response.status !== 201) {
      throw new GitHubError(
        "Could not mint an installation token",
        response.status,
        await safeText(response),
      );
    }
    const payload = (await response.json()) as { token?: string; expires_at?: string };
    if (typeof payload.token !== "string") {
      throw new GitHubError("Installation token response was malformed", 502);
    }
    const parsedExpiry = payload.expires_at ? Date.parse(payload.expires_at) : NaN;
    const record: InstallationToken = {
      token: payload.token,
      expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : this.now() + 3_600_000,
    };
    this.tokenCache.set(installationId, record);
    return record;
  }

  async verifyUserToken(token: string): Promise<GitHubUser> {
    if (!/^[A-Za-z0-9_]{20,}$/.test(token)) {
      throw new GitHubError("Malformed GitHub token", 401);
    }
    const response = await this.request("/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": API_VERSION,
      },
    });
    if (response.status !== 200) {
      throw new GitHubError("GitHub rejected the user token", 401, await safeText(response));
    }
    const payload = (await response.json()) as {
      id?: number;
      login?: string;
      avatar_url?: string;
    };
    if (typeof payload.id !== "number" || typeof payload.login !== "string") {
      throw new GitHubError("GitHub user response was malformed", 502);
    }
    return {
      id: payload.id,
      login: payload.login,
      avatarUrl: payload.avatar_url ?? null,
    };
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

/** Exposed for tests: decode a compact JWT without verifying. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const segment = token.split(".")[1] ?? "";
  return JSON.parse(fromUtf8(base64UrlToBytes(segment))) as Record<string, unknown>;
}

export function pemBytesLength(pem: string): number {
  return utf8(pem).length;
}
