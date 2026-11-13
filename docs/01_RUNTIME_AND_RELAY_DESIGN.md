# AETHER AI — Runtime, relay and token-broker design

**Status:** design for owner approval · 2026-11-13
**Applies to:** ADR-001 (GitHub-hosted Actions runtime, GitHub App, device flow, token broker)

---

## 1. The hard constraint that shapes everything

A GitHub-hosted runner:

- is a fresh ephemeral VM per job;
- has **outbound** internet access only — it exposes no inbound port and no stable address;
- is destroyed when the job ends (disk included);
- is capped at **6 hours** per job.

The Android app therefore **cannot connect to the runner**. Any live chat requires a rendezvous point both sides can reach: a relay. That relay is also the natural home for the token broker, so one small service covers both jobs — it does **not** run the agent and does **not** replace Actions.

```
Android app ──WSS──► Relay + token broker ◄──WSS── GitHub Actions runner (Hermes gateway)
     │                       │                              │
     │ GitHub REST           │ GitHub App JWT → IAT         │ encrypted checkpoints
     ▼                       ▼                              ▼
 GitHub identity      installation tokens            private repository
```

---

## 2. Transport tiers (choose one)

### Tier 1 — GitHub-native transport, no extra server (fallback)
- App writes a prompt file to the workspace repo via the Contents API.
- The running job polls the repo (e.g. every 5 s) for new prompts and commits response chunks.
- **Pros:** zero infrastructure; nothing outside GitHub.
- **Cons:** 5–20 s latency, one commit per exchange (repository churn), no true streaming, poor UX for tool approvals. Acceptable for start/stop/status/checkpoint, **not** for chat.

### Tier 2 — Relay (required for real chat) — **recommended**
- One small service: WebSocket relay + GitHub App token broker.
- The runner dials **out** to the relay; the app dials **in** over TLS.
- Frames are forwarded verbatim as Hermes `hermes-gateway-v1` JSON-RPC messages.
- **Pros:** sub-second streaming, tool events, approvals, reconnect, multi-device.
- **Cons:** one more deployable; a few dollars a month at most.

**Decision required:** approve Tier 2 and choose where the relay runs (§5). AGENTS.md note: the relay never executes agent logic; it authenticates, routes, rate-limits and forgets.

---

## 3. Relay protocol

### 3.1 Identity
- App authenticates to the relay with the GitHub **user access token** (device flow) on first connect; the relay verifies it against `GET /user` and issues a **session ticket** (JWT, 15 min, renewable).
- Runner authenticates with a **run token**: a short-lived JWT minted by the broker and injected into the job as a GitHub Actions secret/config, bound to `run_id`, `repository_id`, `session_id`.
- Tickets are single-use per WebSocket connection. Reconnect gets a new ticket.

### 3.2 Channels
- `session/<uuid>` — one logical agent session.
- Only two members may join: the owning GitHub user and the worker bound to that session.
- Frames: `{v:1, id, type:"rpc"|"event"|"ack"|"ping", session, payload}`.

### 3.3 Controls
- TLS only (WSS).
- Max frame 256 KiB; max 60 frames/s/client; backpressure closes slow consumers with code 1013.
- Replay protection: monotonically increasing frame `seq`, plus ticket nonce.
- Heartbeat every 15 s; 45 s without heartbeat ⇒ session marked `stale` (never "Running").
- No prompt or message content in relay logs; only event type, size, latency, session id.

### 3.4 Failure handling
| Failure | Behaviour |
|---|---|
| Runner dies | Relay marks session `RecoveryRequired`; app offers Resume |
| App disconnects | Session continues; events buffered for 5 min (bounded), then dropped |
| Relay restarts | Sessions are re-established by reconnect; no state beyond short buffers |
| Ticket expired | Auto-renew while user token is valid; otherwise prompt re-auth |
| Duplicate session | Rejected by repository lock + relay session singleton |

---

## 4. Token broker responsibilities

| Responsibility | Detail |
|---|---|
| GitHub App JWT | RS256, `iss = App ID`, `iat = now-60`, `exp = now+540` (≤10 min) |
| Installation token | `POST /app/installations/{id}/access_tokens`, 1 h lifetime, repo-scoped |
| User token refresh | `grant_type=refresh_token` with client secret (device flow issued `offline_access`) |
| Ticket minting | Short-lived, single-use, audience = relay |
| Secret custody | Private key + client secret in env/secret store, never in Git or the APK |
| Rate limiting | Per user and per session; protect GitHub API quota |
| Audit | Append-only metadata: who minted what, when, which repo (no contents) |

Not the broker's job: storing prompts, provider keys, or user data.

---

## 5. Where to host the relay (cost-efficient options)

| Option | Shape | Free tier reality | Fit | Notes |
|---|---|---|---|---|
| **Cloudflare Workers + Durable Objects** | Serverless WebSockets, global | Workers has a free tier; **Durable Objects typically require the paid Workers plan (~$5/mo)** | ★★★★★ | Best latency; DO gives one authoritative object per session; secrets via Wrangler. Verify current pricing. |
| **Deno Deploy** | Serverless WebSockets + KV | Free hobby tier historically includes WebSockets | ★★★★ | Simple TypeScript deploy; verify current limits |
| **Fly.io** | Small always-on machine | Pay-as-you-go, no reliable free tier | ★★★★ | Full control, WebSocket-friendly, ~$2–5/mo for a shared-cpu-1x |
| **Small VPS** (Hetzner/Contabo) | Root Linux box | None | ★★★ | ~€4/mo; you patch it; most work |
| **Supabase Realtime** | Managed channels + RLS | Free tier exists | ★★ | No custom relay logic; awkward for broker secrets and frame control |

**Recommendation:** start on **Deno Deploy** (free, WebSockets, single TypeScript file) and move to **Cloudflare + Durable Objects** if you want per-session isolation and stronger SLAs. Either way the broker holds the App private key; treat it as a secret-bearing service.

**Minimum broker footprint:** one HTTPS endpoint (`/oauth/device`, `/oauth/refresh`, `/ticket`), one WSS endpoint (`/relay`), ~400 lines of TypeScript, one KV/DO namespace. No database required beyond session tickets.

---

## 6. GitHub Actions session lifecycle (implemented shape)

```
workflow_dispatch(profile, model, checkpoint_id)
  └─ job timeout-minutes: 330          # inside the 360 ceiling
      ├─ checkout private workspace repo
      ├─ install pinned Hermes (commit 438008f4…) + Python 3.12 + uv
      ├─ decrypt + restore latest verified checkpoint (hermes backup restore)
      ├─ write config from non-secret profile; inject provider keys from Actions secrets
      ├─ start `hermes gateway` (localhost only) and `hermes gateway attach --json` → ticket
      ├─ connect relay client → session/<id>
      ├─ health check: one real test prompt must succeed
      ├─ publish status Running + heartbeat every 60 s
      ├─ periodic checkpoint every 10 min (commit batch + verify SHA)
      ├─ T-10 min: notify app, stop accepting long tasks
      ├─ T-0: final checkpoint → verify remote → stop Hermes → close relay → Stopped
      └─ always: upload redacted logs, never secrets
```

Guarantees:
- **Saved** is shown only after a read-back of the commit SHA and file hash.
- A failed push retries with bounded backoff and surfaces an actionable error — never a false "Saved".
- The run ends at 5 h, not at the 6 h kill, so the shutdown path is controlled.

Cost per session: **300 minutes** (≈6 sessions/month on Free's 2,000 private minutes).

---

## 7. Disclosure in the product

Settings → About → Runtime will state plainly:

> AETHER runs its agent on GitHub-hosted Actions for sessions of up to 5 hours. GitHub's terms restrict hosted runners to software-project-related work; this configuration is a deliberate owner choice made against that guidance. Sessions may be terminated by GitHub, and state is preserved only through periodic encrypted checkpoints.

---

## 8. Approval checklist

- [x] Tier 2 relay approved (vs Tier 1 only) — owner approved 2026-11-13 and asked for the broker to be built now.
- [x] Relay host chosen (§5) and region noted — **Deno Deploy**, global anycast edge with no region pinning on the free tier; Deno KV is used for single-use tickets.
- [x] Relay domain/subdomain available for TLS — Deno Deploy issues `<project>.deno.dev` with managed TLS. A custom domain is optional and not required for the build.
- [x] Confirmed that the App private key will be stored only in the relay's secret store — implemented as `AETHER_GITHUB_APP_PRIVATE_KEY`, read from the environment and never serialised into a response, log line, or repository.
- [x] Confirmed provider API keys go to the worker via Actions secrets, never through the relay — the relay forwards opaque frames and never parses payloads, so no provider key can transit it by design.

Implementation status: `services/broker/` is written and verified by `Broker CI` (typecheck, 30 unit tests, Deno check). Deployment is the remaining step and needs the owner's GitHub App `client_id`, `client_secret`, App ID and private key entered directly into Deno Deploy's secret store.
