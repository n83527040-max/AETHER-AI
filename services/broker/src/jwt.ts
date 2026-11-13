import {
  base64UrlToBytes,
  bufferSource,
  bytesToBase64Url,
  fromUtf8,
  stringToBase64Url,
  utf8,
} from "./base64url.ts";

export type JwtAlgorithm = "RS256" | "HS256";

export class JwtError extends Error {
  readonly code: "malformed" | "unsupported" | "signature" | "expired" | "claims";

  constructor(
    message: string,
    code: "malformed" | "unsupported" | "signature" | "expired" | "claims",
  ) {
    super(message);
    this.name = "JwtError";
    this.code = code;
  }
}

export interface JwtHeader {
  alg: JwtAlgorithm;
  typ?: string;
  kid?: string;
}

export type JwtClaims = Record<string, unknown>;

function encodeJson(value: unknown): string {
  return stringToBase64Url(JSON.stringify(value));
}

function decodeJson(segment: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(fromUtf8(base64UrlToBytes(segment)));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new JwtError("JWT segment is not an object", "malformed");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof JwtError) {
      throw error;
    }
    throw new JwtError("JWT segment is not valid JSON", "malformed");
  }
}

async function keyForVerify(alg: JwtAlgorithm, key: CryptoKey): Promise<AlgorithmIdentifier | RsaPssParams | EcdsaParams | HmacImportParams> {
  return alg === "RS256" ? { name: "RSASSA-PKCS1-v1_5" } : { name: "HMAC" };
}

export async function signJwt(
  claims: JwtClaims,
  key: CryptoKey,
  alg: JwtAlgorithm,
): Promise<string> {
  const header: JwtHeader = { alg, typ: "JWT" };
  const signingInput = `${encodeJson(header)}.${encodeJson(claims)}`;
  const algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams | HmacImportParams =
    alg === "RS256" ? { name: "RSASSA-PKCS1-v1_5" } : { name: "HMAC" };
  const signature = new Uint8Array(
    await crypto.subtle.sign(algorithm, key, bufferSource(utf8(signingInput))),
  );
  return `${signingInput}.${bytesToBase64Url(signature)}`;
}

export interface VerifyOptions {
  now?: () => number;
  clockSkewSeconds?: number;
}

export async function verifyJwt(
  token: string,
  key: CryptoKey | ((header: JwtHeader) => Promise<CryptoKey>),
  alg: JwtAlgorithm,
  options: VerifyOptions = {},
): Promise<JwtClaims> {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new JwtError("JWT must have three segments", "malformed");
  }
  const [headerSegment, payloadSegment, signatureSegment] = segments as [string, string, string];
  const header = decodeJson(headerSegment) as unknown as JwtHeader;
  if (header.alg !== alg) {
    throw new JwtError(`Unsupported algorithm ${String(header.alg)}`, "unsupported");
  }
  const resolved = typeof key === "function" ? await key(header) : key;
  const algorithm = await keyForVerify(alg, resolved);
  const valid = await crypto.subtle.verify(
    algorithm,
    resolved,
    bufferSource(base64UrlToBytes(signatureSegment)),
    bufferSource(utf8(`${headerSegment}.${payloadSegment}`)),
  );
  if (!valid) {
    throw new JwtError("JWT signature is invalid", "signature");
  }
  const claims = decodeJson(payloadSegment);
  const nowSeconds = Math.floor((options.now?.() ?? Date.now()) / 1000);
  const skew = options.clockSkewSeconds ?? 60;
  if (typeof claims.exp === "number" && nowSeconds - skew >= claims.exp) {
    throw new JwtError("JWT has expired", "expired");
  }
  if (typeof claims.nbf === "number" && nowSeconds + skew < claims.nbf) {
    throw new JwtError("JWT is not valid yet", "claims");
  }
  if (typeof claims.iat === "number" && nowSeconds + skew < claims.iat) {
    throw new JwtError("JWT issued in the future", "claims");
  }
  return claims;
}

export async function importRsaKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

export async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bufferSource(utf8(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
