import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { bufferSource } from "../src/base64url.ts";
import { decodeJwtPayload, GitHubAppAuth, GitHubError, importPrivateKey } from "../src/github.ts";
import { signJwt, verifyJwt } from "../src/jwt.ts";

function pemToDer(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const pkcs1Pem = execFileSync("openssl", ["genrsa", "-traditional", "2048"]).toString();
const publicPem = execFileSync("openssl", ["rsa", "-pubout"], { input: pkcs1Pem }).toString();
const pkcs8Pem = execFileSync("openssl", ["pkcs8", "-topk8", "-nocrypt"], { input: pkcs1Pem }).toString();

test("imports a PKCS#1 key and signs verifiable RS256 tokens", async () => {
  const privateKey = await importPrivateKey(pkcs1Pem);
  const publicKey = await crypto.subtle.importKey(
    "spki",
    bufferSource(pemToDer(publicPem)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const token = await signJwt({ sub: "pkcs1" }, privateKey, "RS256");
  const claims = await verifyJwt(token, publicKey, "RS256");
  assert.equal(claims.sub, "pkcs1");
});

test("imports a PKCS#8 key", async () => {
  const key = await importPrivateKey(pkcs8Pem);
  const token = await signJwt({ sub: "pkcs8" }, key, "RS256");
  assert.equal((await verifyJwt(token, await publicKeyFrom(publicPem), "RS256")).sub, "pkcs8");
});

async function publicKeyFrom(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    bufferSource(pemToDer(pem)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

test("app JWT uses the documented 60s backdate and a short lifetime", async () => {
  const now = 1_700_000_000_000;
  const auth = await GitHubAppAuth.create({
    appId: "123456",
    privateKeyPem: pkcs1Pem,
    now: () => now,
  });
  const jwt = await auth.appJwt();
  const claims = decodeJwtPayload(jwt);
  assert.equal(claims.iss, "123456");
  assert.equal(claims.iat, Math.floor(now / 1000) - 60);
  assert.equal(claims.exp, Math.floor(now / 1000) + 540);
});

test("installation tokens are cached for their lifetime", async () => {
  const now = 1_700_000_000_000;
  let calls = 0;
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    assert.equal(init?.method, "POST");
    return new Response(
      JSON.stringify({ token: "ghs_test", expires_at: new Date(now + 3_600_000).toISOString() }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;

  const auth = await GitHubAppAuth.create({
    appId: "123456",
    privateKeyPem: pkcs1Pem,
    now: () => now,
    fetchImpl,
  });

  const first = await auth.installationToken(42);
  const second = await auth.installationToken(42);
  assert.equal(first.token, "ghs_test");
  assert.equal(second.token, "ghs_test");
  assert.equal(calls, 1);
});

test("verifies a user token and maps the identity", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ id: 7, login: "octocat", avatar_url: "https://x/y.png" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

  const auth = await GitHubAppAuth.create({
    appId: "123456",
    privateKeyPem: pkcs1Pem,
    fetchImpl,
  });
  const user = await auth.verifyUserToken("ghu_abcdefghijklmnopqrstuvwxyz");
  assert.deepEqual(user, { id: 7, login: "octocat", avatarUrl: "https://x/y.png" });
});

test("rejects malformed and revoked user tokens", async () => {
  const auth = await GitHubAppAuth.create({ appId: "1", privateKeyPem: pkcs1Pem });
  await assert.rejects(() => auth.verifyUserToken("short"), GitHubError);

  const rejecting = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
  const auth2 = await GitHubAppAuth.create({
    appId: "1",
    privateKeyPem: pkcs1Pem,
    fetchImpl: rejecting,
  });
  await assert.rejects(
    () => auth2.verifyUserToken("ghu_abcdefghijklmnopqrstuvwxyz"),
    (error: unknown) => error instanceof GitHubError && error.status === 401,
  );
});
