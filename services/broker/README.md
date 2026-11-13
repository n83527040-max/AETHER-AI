# AETHER broker + relay

A deliberately small Deno Deploy service with two jobs:

1. **Token broker** — holds the GitHub App private key and client secret, verifies user tokens, and mints short-lived relay tickets.
2. **WebSocket relay** — forwards opaque frames between the Android app and the GitHub Actions worker.

It is **not** the agent host. It never runs Hermes, never stores prompts, and has no database beyond single-use tickets.

Deploy target: **Deno Deploy** (selected 2026-11-13). Runtime: Deno with built-in KV.

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness + relay statistics (no sensitive data) |
| POST | `/oauth/device/start` | none | Start GitHub device flow; returns `user_code` + `device_code` |
| POST | `/oauth/device/poll` | none | Poll for the user token; passes GitHub errors through unchanged |
| POST | `/oauth/refresh` | refresh token | Refresh an 8-hour user token using the client secret |
| POST | `/ticket` | GitHub user token | Mint a single-use **app** relay ticket for a session |
| POST | `/worker/ticket` | Actions OIDC token | Mint a single-use **worker** ticket, bound to repo + run |
| GET | `/relay?ticket=…` | ticket | WebSocket upgrade; frames forwarded only to the opposite role |

### Ticket properties
- 32 random bytes, base64url, stored in Deno KV with a TTL (default 60 s).
- **Atomically single-use** — consumed by `kv.atomic().check().delete()`.
- Bound to `session_id`, `role`, `repository`, and (worker) `run_id`.
- Reconnect requires a new ticket; nothing long-lived is handed to either side.

### Worker identity without shared secrets
The GitHub Actions job requests an OIDC token (`permissions: id-token: write`). The broker verifies it against GitHub's JWKS, then checks:
`iss`, `aud` (must be `AETHER_RELAY_AUDIENCE`), `exp`, and `repository` (must equal `AETHER_ALLOWED_REPOSITORY`).
No static worker secret exists to leak.

---

## Environment

| Variable | Class | Required | Notes |
|---|---|---|---|
| `AETHER_GITHUB_APP_ID` | Public | ✅ | Numeric App ID |
| `AETHER_GITHUB_CLIENT_ID` | Public | ✅ | Used for device flow and refresh |
| `AETHER_GITHUB_CLIENT_SECRET` | **Secret** | ✅ | Refresh only; never sent to the app |
| `AETHER_GITHUB_APP_PRIVATE_KEY` | **Secret** | ✅ | PKCS#1 or PKCS#8 PEM; `\n` escapes accepted |
| `AETHER_ALLOWED_REPOSITORY` | Public | ✅ | `owner/name`; single-tenant by design |
| `AETHER_RELAY_AUDIENCE` | Public | ➖ | Default `aether-relay` |
| `AETHER_TICKET_TTL_MS` | Public | ➖ | 15 s–5 min, default 60 s |
| `AETHER_ALLOWED_ORIGINS` | Public | ➖ | Comma-separated; only needed for a web client |
| `AETHER_GITHUB_API_BASE_URL` | Public | ➖ | For GitHub Enterprise |

Configuration is validated at boot and **fails closed**. No secret is ever logged or returned in a response.

---

## Deploy to Deno Deploy

1. Create the app at <https://dash.deno.com> → **New Project** → link this repository.
2. Entry point: `services/broker/src/main.ts`.
3. Add every required variable above under **Settings → Environment Variables** (mark the two secrets as secrets).
4. Deploy. Deno KV is provisioned automatically and used for tickets.
5. Verify:

```bash
curl https://<your-app>.deno.dev/health
# {"status":"ok","version":"0.1.0","time":"…","relay":{"sessions":0,"connections":0}}
```

6. Put the app URL into the Android build flag `AETHER_BROKER_URL`.

### Local development

```bash
cd services/broker
cp .env.example .env    # fill locally; .env is git-ignored
deno run --allow-net --allow-env --allow-sys --env-file=.env src/main.ts
```

---

## Verification (runs without Deno)

```bash
npm install
npm run typecheck     # tsc strict, including the Deno entrypoint via an ambient shim
npm test              # 30 tests, Node's built-in runner
deno check src/main.ts
```

Coverage highlights:

- JWT RS256/HS256 round trip, tamper, expiry, algorithm confusion.
- **PKCS#1 → PKCS#8** wrapping, verified by signing with an OpenSSL-generated key and verifying with its public half.
- Installation-token caching (one network call for two reads).
- Ticket single-use, role binding, expiry, malformed IDs.
- Relay routing, peer-absence, oversized frames, rate limiting, socket replacement, stale sweep.
- HTTP: device-flow proxying (no secret in the request), GitHub error passthrough, bearer enforcement, repository binding, worker OIDC path, structured 404.

---

## Security model

| Threat | Mitigation |
|---|---|
| App reverse-engineered | No client secret, private key, or provider key in the APK |
| Stolen user token | Short-lived (8 h), verified against GitHub, only mints tickets |
| Replayed relay ticket | Single-use, 60 s TTL, KV compare-and-delete |
| Foreign repository | `repository` claim must equal `AETHER_ALLOWED_REPOSITORY` |
| Rogue worker | Must present a GitHub-signed OIDC token for the same repo |
| Frame flooding | 256 KiB frame cap, 60 msg/s per role, close codes 1009/1008 |
| Silent sessions | 45 s heartbeat sweep, close code 4000 |
| Secret leakage in logs | Payloads are never inspected or logged; only counts and timings |

### Explicit non-goals
- No end-to-end encryption above TLS/WSS. The relay must see frame boundaries to route them.
- No message store. If neither side is connected, frames are dropped; durable state lives in checkpoints in the private repository.
- No multi-tenant routing. One broker instance serves one repository.

---

## Protocol notes for the worker

The relay is transport-agnostic: it forwards text frames as-is. The worker adapter is responsible for
speaking Hermes' `hermes-gateway-v1` JSON-RPC over that tunnel (see the Hermes gateway docs). Keeping the
relay dumb means a Hermes protocol change does not require redeploying the broker.
