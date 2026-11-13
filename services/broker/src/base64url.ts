/** Base64url without padding — the only encoding used by JOSE. */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function stringToBase64Url(value: string): string {
  return bytesToBase64Url(textEncoder.encode(value));
}

export function base64UrlToString(value: string): string {
  return textDecoder.decode(base64UrlToBytes(value));
}

export function utf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function fromUtf8(value: Uint8Array): string {
  return textDecoder.decode(value);
}

export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/** WebCrypto's BufferSource under TS 5.9's stricter ArrayBuffer typing. */
export function bufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}
