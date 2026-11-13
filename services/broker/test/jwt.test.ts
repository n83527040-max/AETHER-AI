import assert from "node:assert/strict";
import test from "node:test";

import { hmacKey, signJwt, verifyJwt, JwtError } from "../src/jwt.ts";

async function rsaPair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]) as unknown as Uint8Array<ArrayBuffer>,
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  return pair as CryptoKeyPair;
}

test("RS256 round trip preserves claims", async () => {
  const pair = await rsaPair();
  const now = 1_700_000_000_000;
  const token = await signJwt({ sub: "user-1", exp: Math.floor(now / 1000) + 60 }, pair.privateKey, "RS256");
  const claims = await verifyJwt(token, pair.publicKey, "RS256", { now: () => now });
  assert.equal(claims.sub, "user-1");
});

test("tampered payload fails signature verification", async () => {
  const pair = await rsaPair();
  const token = await signJwt({ sub: "user-1" }, pair.privateKey, "RS256");
  const [header, , signature] = token.split(".");
  const forged = `${header}.${btoa('{"sub":"admin"}').replace(/=+$/, "")}.${signature}`;
  await assert.rejects(
    () => verifyJwt(forged, pair.publicKey, "RS256"),
    (error: unknown) => error instanceof JwtError && error.code === "signature",
  );
});

test("expired tokens are rejected", async () => {
  const pair = await rsaPair();
  const token = await signJwt({ exp: 1_600_000_000 }, pair.privateKey, "RS256");
  await assert.rejects(
    () => verifyJwt(token, pair.publicKey, "RS256", { now: () => 1_700_000_000_000 }),
    (error: unknown) => error instanceof JwtError && error.code === "expired",
  );
});

test("algorithm confusion is rejected", async () => {
  const pair = await rsaPair();
  const token = await signJwt({ sub: "x" }, pair.privateKey, "RS256");
  await assert.rejects(
    () => verifyJwt(token, pair.publicKey, "HS256"),
    (error: unknown) => error instanceof JwtError && error.code === "unsupported",
  );
});

test("HS256 round trip and wrong key rejection", async () => {
  const key = await hmacKey("a".repeat(32));
  const other = await hmacKey("b".repeat(32));
  const token = await signJwt({ sub: "relay" }, key, "HS256");
  const claims = await verifyJwt(token, key, "HS256");
  assert.equal(claims.sub, "relay");
  await assert.rejects(
    () => verifyJwt(token, other, "HS256"),
    (error: unknown) => error instanceof JwtError && error.code === "signature",
  );
});
