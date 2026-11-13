# ADR-002 — Broker and relay move from Deno Deploy to Cloudflare Workers

**Status:** accepted · **Date:** 2026-11-13 · **Supersedes:** the hosting choice inside ADR-001 §4 (relay host only)

## Context

ADR-001 approved a separate token broker + relay that keeps the GitHub App private key and client secret
server-side while GitHub-hosted Actions runs the agent. The owner first selected Deno Deploy and the service
was built, tested, and deployed-ready for that platform.

The owner then reported two facts about Deno Deploy:

- new account registrations are closed;
- the platform is scheduled to shut down in April 2027.

A broker that cannot be deployed by the owner, or that disappears in 17 months, cannot carry the GitHub App
credential. The service therefore has to move before sign-in is wired into the app.

## Decision

Host the broker and relay on **Cloudflare Workers**, in the existing `services/broker` directory, Worker name
`aether-broker`. GitHub Actions remains the agent runtime; Cloudflare does not execute Hermes.

| Concern | Deno implementation | Cloudflare implementation |
|---|---|---|
| HTTP entry | `Deno.serve` in `src/main.ts` | `fetch` handler in `src/worker.ts`, `main` in `wrangler.toml` |
| Single-use tickets | Deno KV, `atomic().check().delete()` | `TicketVault` Durable Object — read + delete inside one event |
| Relay connections | module-level `Map` inside one isolate | `RelaySession` Durable Object per session id, hibernatable WebSockets |
| Session/repo binding | ticket claims only | ticket claims **and** storage binding in the session object |
| Live counters | `Relay.stats()` in memory | `RelayRegistry` Durable Object |
| Secrets | Deno Deploy env | Worker secrets (`wrangler secret put`) |
| Config | `deno.json` | `wrangler.toml` |

Cloudflare KV was considered and rejected: every datum here needs read-then-write atomicity or per-session
coordination, which KV's eventual consistency cannot provide.

## Why Cloudflare instead of another Deno-compatible host

- Durable Objects map one-to-one onto the semantics already written and tested: single-use tickets, one relay
  session per id, atomic attach.
- WebSocket hibernation keeps an idle 5-hour session nearly free.
- The owner already has the account and is inside the GitHub deployment flow.
- No new programming model for the app: still WSS + JSON frames.

## Consequences

- `deno.json`, `types/deno.d.ts`, `src/main.ts`, `src/deno_kv.ts` are deleted; there is no Deno dependency left.
- The framework-agnostic core (`jwt`, `github`, `oidc`, `tickets`, `relay`, `http`) is untouched, so all
  existing tests still run and still apply.
- Deployment is via Workers Builds (root directory `services/broker`) or `npx wrangler deploy`; CI gained a
  `deploy` job that only runs when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist, plus a live
  `/health` assertion.
- Vendor coupling is limited to three Durable Object classes and the `wrangler.toml` bindings.
- One Workers-only defect was found by running the real runtime: calling the stored global `fetch` as a
  method raised `Illegal invocation`. It is fixed and covered by a regression test.

## Risks accepted

| Risk | Mitigation |
|---|---|
| Free-plan Durable Object limits | Ticket/session volume is tiny (one user, one session); the real cost gate is GitHub Actions minutes, unchanged by this ADR |
| Workers runtime differences from Node | Worker tests run inside workerd, not a Node shim |
| Migration churn late in the project | Core logic unchanged; only transport and storage swapped, with the same API surface |

## Verification

- 38 Node unit tests, 8 workerd tests, both strict typechecks green.
- Live `wrangler dev`: `/health` 200, GitHub device flow 200 with a real `user_code`, poll `authorization_pending`,
  invalid user token → `401 github_token_rejected`.
- Production deployment is **not** verified yet; it needs the owner's Cloudflare credentials.

## Rollback

Revert `services/broker` to commit `ce4c223` (Deno implementation) and delete the Worker. No app data lives in
Durable Objects beyond 60-second tickets and connection counters, so rollback loses nothing.
