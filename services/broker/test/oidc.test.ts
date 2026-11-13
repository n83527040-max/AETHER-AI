import assert from "node:assert/strict";
import test from "node:test";

import { ACTIONS_OIDC_ISSUER, OidcError, verifyActionsOidc } from "../src/oidc.ts";
import { signJwt } from "../src/jwt.ts";

const REPOSITORY = "n83527040-max/AETHER-AI";
const AUDIENCE = "aether-relay";
const NOW = 1_700_000_000_000;

async function keyPair(): Promise<CryptoKeyPair> {
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

async function jwksFor(pair: CryptoKeyPair): Promise<JsonWebKey[]> {
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return [{ ...jwk, kid: "test-key", use: "sig", alg: "RS256" } as JsonWebKey];
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: ACTIONS_OIDC_ISSUER,
    aud: AUDIENCE,
    repository: REPOSITORY,
    ref: "refs/heads/main",
    run_id: "99",
    exp: Math.floor(NOW / 1000) + 300,
    iat: Math.floor(NOW / 1000) - 5,
    ...overrides,
  };
}

test("accepts a token signed by GitHub's published key", async () => {
  const pair = await keyPair();
  const token = await signJwt(claims(), pair.privateKey, "RS256");
  const verified = await verifyActionsOidc(token, {
    audience: AUDIENCE,
    allowedRepository: REPOSITORY,
    now: () => NOW,
    jwks: await jwksFor(pair),
  });
  assert.equal(verified.repository, REPOSITORY);
  assert.equal(verified.run_id, "99");
});

test("rejects a token for another repository", async () => {
  const pair = await keyPair();
  const jwks = await jwksFor(pair);
  const token = await signJwt(claims({ repository: "attacker/repo" }), pair.privateKey, "RS256");
  await assert.rejects(
    () =>
      verifyActionsOidc(token, {
        audience: AUDIENCE,
        allowedRepository: REPOSITORY,
        now: () => NOW,
        jwks,
      }),
    (error: unknown) => error instanceof OidcError && error.code === "unauthorized",
  );
});

test("rejects a token for another audience", async () => {
  const pair = await keyPair();
  const token = await signJwt(claims({ aud: "some-other-service" }), pair.privateKey, "RS256");
  const jwks = await jwksFor(pair);
  await assert.rejects(
    () =>
      verifyActionsOidc(token, {
        audience: AUDIENCE,
        allowedRepository: REPOSITORY,
        now: () => NOW,
        jwks,
      }),
    (error: unknown) => error instanceof OidcError && error.code === "unauthorized",
  );
});

test("rejects a token with the wrong issuer", async () => {
  const pair = await keyPair();
  const jwks = await jwksFor(pair);
  const token = await signJwt(claims({ iss: "https://evil.example" }), pair.privateKey, "RS256");
  await assert.rejects(
    () =>
      verifyActionsOidc(token, {
        audience: AUDIENCE,
        allowedRepository: REPOSITORY,
        now: () => NOW,
        jwks,
      }),
    OidcError,
  );
});

test("rejects an expired token", async () => {
  const pair = await keyPair();
  const jwks = await jwksFor(pair);
  const token = await signJwt(
    claims({ exp: Math.floor(NOW / 1000) - 3600 }),
    pair.privateKey,
    "RS256",
  );
  await assert.rejects(
    () =>
      verifyActionsOidc(token, {
        audience: AUDIENCE,
        allowedRepository: REPOSITORY,
        now: () => NOW,
        jwks,
      }),
    (error: unknown) => error instanceof OidcError && error.code === "unauthorized",
  );
});

test("rejects a token signed by a different key", async () => {
  const trusted = await keyPair();
  const attacker = await keyPair();
  const jwks = await jwksFor(trusted);
  const token = await signJwt(claims(), attacker.privateKey, "RS256");
  await assert.rejects(
    () =>
      verifyActionsOidc(token, {
        audience: AUDIENCE,
        allowedRepository: REPOSITORY,
        now: () => NOW,
        jwks,
      }),
    (error: unknown) => error instanceof OidcError && error.code === "unauthorized",
  );
});

test("reports GitHub's JWKS as unavailable when it cannot be fetched", async () => {
  const failing = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  await assert.rejects(
    () =>
      verifyActionsOidc("eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJ4In0.c2ln", {
        audience: AUDIENCE,
        allowedRepository: REPOSITORY,
        now: () => NOW,
        fetchImpl: failing,
      }),
    (error: unknown) => error instanceof OidcError && error.code === "unavailable",
  );
});
