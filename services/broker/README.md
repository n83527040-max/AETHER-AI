# AETHER broker + relay (Cloudflare Workers)

A small Worker with two responsibilities:

1. **Token broker** — holds the GitHub App private key and client secret, runs the device flow, verifies GitHub user tokens, and mints short-lived relay tickets.
2. **WebSocket relay** — forwards opaque frames between the Android app and the GitHub Actions worker.

It is **not** the agent host. Hermes keeps running on GitHub-hosted Actions; this Worker never executes agent code, never stores prompts, and keeps no database beyond unspent tickets and live session metadata.

```
Android app ──WSS──┐
                   ├── Cloudflare Worker "aether-broker" ── Durable Objects
Actions worker ────┘        (git identity + tickets)        (tickets, sessions, counters)
```

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness, version, config state, live relay counters |
| POST | `/oauth/device/start` | none | Begin GitHub device flow (`client_id` only) |
| POST | `/oauth/device/poll` | none | Poll for the user token; GitHub errors pass through |
| POST | `/oauth/refresh` | refresh token | Refresh an 8-hour token using the client secret, server-side |
| POST | `/ticket` | GitHub user token | Mint a **single-use** `app` relay ticket |
| POST | `/worker/ticket` | Actions OIDC token | Mint a **single-use** `worker` ticket bound to repo + run |
| GET | `/relay?ticket=…` | ticket | WebSocket upgrade, routed to that session's Durable Object |

Behaviour is unchanged from the previous Deno implementation, apart from the transport.

---

## Durable Objects

| Class | Binding | Responsibility |
|---|---|---|
| `TicketVault` | `TICKETS` | All unspent tickets. `take` reads and deletes inside one event, so a ticket can be spent once even under concurrent requests. An alarm deletes expired records. |
| `RelaySession` | `SESSIONS` | One per session id. Owns the app and worker WebSockets, binds the session to one repository, enforces frame size, rate limits, heartbeat, and reconnect replacement (close 4001). Hibernatable: idle sessions cost nothing and payloads are never written to storage. |
| `RelayRegistry` | `REGISTRY` | Join/leave counters for `/health`; entries older than 30 minutes are pruned. |

Cloudflare KV is deliberately **not** used: every piece of state here needs read-then-write atomicity or per-session coordination, which KV does not provide.

---

## Cloudflare configuration

`wrangler.toml` is committed and contains only public values:

| Name | Kind | Value / source |
|---|---|---|
| `AETHER_GITHUB_APP_ID` | var | `5750435` |
| `AETHER_GITHUB_CLIENT_ID` | var | `Iv23ctJ8d5xFlRUU9mIm` |
| `AETHER_ALLOWED_REPOSITORY` | var | `n83527040-max/AETHER-AI` |
| `AETHER_RELAY_AUDIENCE` | var | `aether-relay` |
| `AETHER_GITHUB_CLIENT_SECRET` | **secret** | GitHub App settings → Client secrets |
| `AETHER_GITHUB_APP_PRIVATE_KEY` | **secret** | GitHub App settings → Private keys (`.pem` contents) |

> **Client ID correction.** The value supplied in chat was `Iv23ctJ8d5xFIRUU9mIm`.
> GitHub's public API (`GET https://api.github.com/apps/AETHER-AI-Assistant`) reports
> `Iv23ctJ8d5x**Fl**RUU9mIm` — an `l`, not an `I`. With the original value the device
> endpoint answers `{"error":"Not Found"}`; with the corrected value it returns a real
> `user_code`. `wrangler.toml` uses the corrected, API-verified value.

### Adding the two secrets (pick one)

**Dashboard:** Workers & Pages → `aether-broker` → Settings → Variables and Secrets → *Add* → type **Secret** →
`AETHER_GITHUB_CLIENT_SECRET`, then repeat for `AETHER_GITHUB_APP_PRIVATE_KEY`.
Paste the PEM exactly as downloaded (multi-line); Wrangler stores it encrypted.

**Wrangler (from `services/broker`):**

```bash
npx wrangler login
npx wrangler secret put AETHER_GITHUB_CLIENT_SECRET
npx wrangler secret put AETHER_GITHUB_APP_PRIVATE_KEY
```

Neither value is ever printed by this Worker, written to logs, returned by an endpoint, or included in the Android build.

---

## Deployment

### Workers Builds (the GitHub setup screen)

| Setting | Value |
|---|---|
| Repository | `n83527040-max/AETHER-AI` |
| Production branch | `arena/eb94c696-aether-ai` (or `main` once merged) |
| **Root directory** | `services/broker` |
| Build command | `npm ci` |
| Deploy command | `npx wrangler deploy` |
| Worker name | `aether-broker` (from `wrangler.toml`) |

The root directory is **not** the repository root: `wrangler.toml` lives in `services/broker`.

### Local

```bash
cd services/broker
cp .dev.vars.example .dev.vars     # fill with real values; git-ignored
npm ci
npm run dev                        # http://127.0.0.1:8788
```

### Manual deploy

```bash
cd services/broker
npm ci
npx wrangler deploy
curl -fsS https://aether-broker.<your-subdomain>.workers.dev/health
```

---

## Verification

```bash
npm run typecheck   # strict tsc for the Node sources and the Worker sources
npm test            # 38 tests — node:test
npm run test:worker # 8 tests — real workerd, real Durable Objects, real WebSockets
npm run build       # wrangler deploy --dry-run (bundles without credentials)
```

| Requirement | How it is checked | Status |
|---|---|---|
| Ticket atomicity / single use | 10 concurrent `take` calls yield exactly 1 ticket (workerd) | ✅ automated |
| Session + repository binding | Second repo cannot join an existing session (403) | ✅ automated |
| Relay connection coordination | app↔worker forwarding, replays rejected, socket replacement 4001 | ✅ automated |
| Frame size / rate limit / heartbeat | Unit tests on the relay core + Worker tests | ✅ automated |
| GitHub device flow | Live call through `wrangler dev` to GitHub: `200` + real `user_code` | ✅ verified 2026-11-13 |
| Device poll error passthrough | Live call returned `authorization_pending` | ✅ verified 2026-11-13 |
| Invalid user token handling | Live call rejected with `401 github_token_rejected` | ✅ verified 2026-11-13 |
| Actions OIDC verification | 7 tests: signature, issuer, audience, repository, expiry, JWKS outage | ✅ automated |
| `/health` | Local Worker `200 {"status":"ok"}`; live check runs in CI after deploy | ✅ local / ⏳ production |
| Live deployment | Requires your Cloudflare credentials | ⏳ **not verified** |

A real Actions OIDC token only exists inside a running workflow, so the first true end-to-end OIDC check happens when the worker workflow runs.

---

## Security model

| Threat | Mitigation |
|---|---|
| App reverse-engineered | No client secret, App private key, or provider key in the APK |
| Stolen user token | Short-lived, verified against GitHub, can only mint tickets |
| Replayed relay ticket | Single-use read-and-delete in one Durable Object event, 60 s TTL |
| Foreign repository | Ticket claim and session binding must equal `AETHER_ALLOWED_REPOSITORY` |
| Rogue worker | GitHub-signed OIDC token for the same repository, audience checked |
| Frame flooding | 256 KiB cap, 60 msg/s per connection, close codes 1009/1008 |
| Silent sessions | 15 s alarm sweep, close code 4000 after 45 s of silence |
| Secret leakage | Secrets only in Cloudflare's encrypted store; logs contain names and messages, never payloads or tokens |

Not provided: end-to-end encryption above TLS (the relay must see frame boundaries), message persistence (checkpoints live in the private repository), and multi-tenancy (one broker ↔ one repository).

---

## Cost

Workers Free covers this comfortably for a single user: Durable Object requests are billed per request
(not per idle second) while WebSockets hibernate, and the relay is quiet when you are not chatting.
Paid Workers ($5/month) is only needed if you exceed the free request/duration allowances.
