# AETHER AI — Phase 0–2 Report
## Pack audit · Official-source research · Feasibility verdict · Decision gates

**Prepared:** 2026-11-13
**Author:** Arena Agent (principal research / Flutter architecture / security review)
**Status:** **STOPPED AT MANDATORY GATE** — awaiting two decisions before any production code.
**Code written so far:** none. No screen is mocked. No integration is claimed to work.

---

## 1. Executive summary

| Question | Answer |
|---|---|
| Was the uploaded pack located and extracted? | **Yes.** `AETHER_AI_Arena_Development_Pack.zip` (11.4 MB) → 10 documents, 4 brand assets, 23 UI references. All read/inspected. |
| Can the AETHER Flutter app be built as specified? | **Yes**, with one architecture amendment and a few disclosed constraints. |
| Is the requested 5-hour session technically possible on GitHub-hosted Actions? | **Technically yes (6 h job ceiling), but policy-prohibited.** GitHub's Terms forbid GitHub-hosted runners for "any other activity unrelated to the production, testing, deployment, or publication of the software project". An interactive personal agent is exactly that. **Do not ship it this way.** |
| Recommended runtime instead? | A small **dedicated compute host** (VPS / home server / phone-Termux / serverless sandbox) running the real Hermes gateway, with **GitHub retained for identity, orchestration, and repository-backed persistence**. The 5-hour session lifecycle and Resume Agent stay exactly as specified. |
| Recommended GitHub identity model? | **GitHub App**, with a minimal server-side token broker (private key + client secret never on the device). OAuth App is the fallback if you want zero server components, at the cost of `repo`/`workflow` classic scopes. |
| Can I build & test the APK inside this sandbox? | **No.** No Flutter/Dart/Java/Android SDK, and the sandbox network does not reach `storage.googleapis.com` or `pub.dev`. The APK must be produced by CI (GitHub Actions — a legitimate use: producing the app's own release) or on your machine. Disclosed in §9. |
| Anything else blocked? | Google restricted scopes (Gmail read / full Drive) need Google verification (+ CASA); Google Colab has no public runtime-control API; free-model availability cannot be guaranteed. All three are marked, not faked. |

**Nothing below is implemented yet. This is research + a gate, as the pack requires.**

---

## 2. Pack audit — what was inspected

Archive root: `AETHER_AI_Arena_Development_Pack/` (extracted to `.pack/` in the repo).

| File | Size | What it governs | Read |
|---|---|---|---|
| `README.md` | 2.9 KB | Pack order, reality checks on Actions | ✅ complete |
| `01_ARENA_MASTER_PROMPT.md` | 21.3 KB / 405 lines | Hard phase gates, product identity, runtime, providers, skills, UI rules, deliverables, definition of done | ✅ complete |
| `02_PROJECT_SPECIFICATIONS.md` | 5.7 KB / 114 lines | SRS: FR-01…FR-12, NFRs, out-of-scope, data entities | ✅ complete |
| `03_RESEARCH_AND_OFFICIAL_SOURCES.md` | 5.8 KB | Mandated research plan + official source list | ✅ complete |
| `04_GITHUB_APP_OAUTH_SETUP.md` | 4.5 KB | GitHub App vs OAuth decision fields, secret rules | ✅ complete |
| `05_ARCHITECTURE_AND_WORKFLOWS.md` | 3.5 KB | Components, state machine, 5-h lifecycle, relay, persistence protocol | ✅ complete |
| `06_FEATURES_AND_ACCEPTANCE_TESTS.md` | 3.4 KB | Acceptance checklist + test matrix | ✅ complete |
| `07_UI_DESIGN_REFERENCE.md` | 3.3 KB | Brand, global UI rules, page-by-page notes | ✅ complete |
| `08_SECURITY_PRIVACY_AND_DATA.md` | 1.9 KB | Secrets, OAuth, approvals, privacy | ✅ complete |
| `09_IMPLEMENTATION_ROADMAP.md` | 2.5 KB | Phases 0–9 and gate policy | ✅ complete |
| `assets/AETHER_AI_App_Icon_1024.png` | 1254×1254 | Brand icon (violet "A" prism, orbit ring, planet horizon) | ✅ viewed |
| `assets/AETHER_AI_App_Icon_512.png` | 512×512 | Icon derivative | ✅ viewed |
| `assets/ASSET_MANIFEST.json` | — | Asset index + screen list | ✅ parsed |
| `assets/UI_Concept_Full_Showcase.png` | 1536×1024 | Full board (Arabic) | ✅ viewed |
| `assets/UI_Concept_Chat_Providers.png` | 1536×1024 | Chat/providers board (Arabic) | ✅ viewed |
| `assets/UI_Concept_Original_Home.png` | 1536×1024 | English home/sidebar/resume trio | ✅ viewed |
| `assets/ui_pages/01…15` | 300–390 px wide | Real screen mockups (splash → free models) | ✅ viewed as contact sheets |
| `assets/ui_pages/16…23` | 720×1280 | **Specification-only placeholder cards** ("Follow the detailed screen requirements in 02_PROJECT_SPEC") | ✅ confirmed identical placeholders |

### Visual identity extracted

- Deep navy / near-black surfaces (~`#07080F`–`#0D1020`), violet accent (~`#7C5CFF`), cyan highlight (~`#4FE3E0`), soft purple glows.
- Rounded 16–20 px cards, thin 1 px violet-tinted borders, generous spacing, centered single-column onboarding with 4-dot step indicator.
- Agent avatar: helmeted dark-violet figure with glowing eyes. Status pill "Running ●" in green, "Stopped" grey.
- Typography: large light-weight display headings, compact labels, monospace for IDs/keys (`sk-or-v1-••••`).
- Chat: user bubble violet, assistant bubble translucent dark card; tool/task panel as a nested card with checklist rows and file chips.
- Sidebar: "New Chat" filled violet pill at top, sectioned destinations, searchable chat history grouped by Today/Yesterday/Older.
- No bottom navigation anywhere in the references — consistent with the written rule.
- Onboarding screens 1–8 carry Arabic copy in the references; the app must ship its own localized strings (ar/en/fr), not the mockup text.

### Intentional content errors in the mockups (must not be copied)
- Fake sample identity "Yassine", fake counts (127 chats / 18 skills / 34 MB), fake uptime `04:32:18`, fake `sk-or-v1-…` key, a hardcoded "free models" list, and an "OpenAI (ChatGPT)" entry implying subscription == API access. The written spec explicitly forbids all of these as real data.

---

## 3. Research method and ledger

Accessed **2026-11-13**. Primary sources only (official docs, official source code). Hermes findings come from a full clone of `NousResearch/hermes-agent` at commit **`438008f475fd89dd661ab2fda8355303a9f7bda6`** (2026-11-13), including its in-repo `website/docs`.

### 3.1 Platform & app framework

| Topic | Current finding | Source | Impact | Risk | Decision |
|---|---|---|---|---|---|
| Flutter stable | **3.50.0** is current stable (3.47, 3.44, 3.41 still recent) | docs.flutter.dev/release/release-notes | Pin SDK 3.50.0, record `flutter --version` in `docs/BUILD.md` | Low | Use 3.50.x |
| Architecture guidance | Flutter's official app-architecture guide: feature-first layering (UI → domain/use-case → data/repository), dependency injection at app root | docs.flutter.dev/app-architecture/guide | Enforce `lib/features/<feature>/{presentation,domain,data}` + `lib/core` | Low | Feature-first |
| State management | Riverpod is the mainstream, testable choice with compile-safe DI; Bloc equally valid | docs.flutter.dev + package docs | Pick **one**; spec forbids mixing | Low | Riverpod (documented ADR) |
| Localization | `flutter_localizations` + ARB `gen-l10n`; `Directionality` handles RTL | docs.flutter.dev i18n | ar / en / fr from day 1; no hardcoded strings | Low | gen-l10n |
| Android baseline | Spec asks Android 8+; Keystore, Custom Tabs, photo picker all available at API 26 | developer.android.com | `minSdk 26`, `targetSdk` = current Play requirement | Low | 26 |
| Secure storage | Android Keystore-backed `flutter_secure_storage`; EncryptedSharedPreferences behind it | developer.android.com/privacy-and-security/keystore | Only short-lived tokens on device; never provider keys in cleartext | Medium | Adopt + biometric gate optional |
| OAuth in browser | System browser / Custom Tabs + app link or custom-scheme callback; validate `state` and exact URI | developer.android.com/training/app-links | No embedded WebView (also explicitly forbidden) | Medium | AppAuth-style flow |
| File access | Storage Access Framework / Android photo picker; scoped storage | developer.android.com photo picker | Never scan all device storage | Low | SAF + picker |
| Build toolchain | Not present in this sandbox (no `flutter`, `dart`, `java`, `gradle`, Android SDK); `storage.googleapis.com` / `pub.dev` unreachable | sandbox probe | **Cannot compile APK here** — CI or local build required | **High (delivery)** | GitHub Actions release workflow (§9) |

### 3.2 Hermes Agent — verified capabilities

Hermes is a real, MIT-licensed, actively developed agent runtime (Python ≥3.11,<3.15 at this commit). Entry points: `hermes`, `hermes-agent`, `hermes-acp`.

| Topic | Current finding | Source (in-repo) | Impact |
|---|---|---|---|
| Programmatic interfaces | **Three documented protocols**: ACP over stdio; **TUI-gateway JSON-RPC** over stdio *or WebSocket* (`/api/ws`, protocol `hermes-gateway-v1`, single-use ticket); **OpenAI-compatible HTTP API + SSE** (`/v1/chat/completions`, `/v1/runs`, `/v1/responses`) | `website/docs/developer-guide/programmatic-integration.md`, `user-guide/features/api-server.md` | **Do not invent an API.** Mobile should speak the gateway JSON-RPC over WSS (full fidelity: streaming, tool events, approvals, steering, sessions) with the OpenAI-compatible API as fallback for simple chat |
| Gateway auth | Per-connection single-use ticket; API server uses `API_SERVER_KEY` bearer token; host identity endpoint is token-gated | `tui_gateway/ws.py`, `gateway/host_rendezvous.py`, `api-server.md` | Relay must mint short-lived tickets; never expose a raw port |
| Sessions | Canonical session state in **SQLite `state.db`** (metadata, messages, model config); FTS5 search + summarisation; session create/list/history/steer/interrupt/branch/compress/usage methods | `website/docs/developer-guide/session-storage.md`, method catalog | Conversation list/search in the app maps to real Hermes verbs |
| Memory | Bounded curated memory: `MEMORY.md` (2,200 chars) + `USER.md` (1,375 chars) in `~/.hermes/memories/`, injected at session start; optional external memory providers | `user-guide/features/memory.md` | "Memory & Data" screen edits real files, with limits shown; no fake "127 memories" |
| Skills | On-demand knowledge docs in **`~/.hermes/skills/`**, compatible with **agentskills.io**; Skills Hub install pipeline includes **security scan**, action log; supports external skill dirs | `user-guide/features/skills.md`, `skills/`, `optional-skills/` | Skills Manager should call documented CLI/hub operations, validate `SKILL.md`, scan before activation |
| Backup / restore | Built-in `hermes backup` produces a verified ZIP of the Hermes home; restore + pre-update/pre-migration backups exist | `hermes_cli/backup.py`, `backup_restore.py` | This **is** the checkpoint primitive: encrypt → push → verify commit SHA |
| Deployment | Headless Linux supported (Dockerfile + compose, systemd notify, idle-exit, scale-to-zero); terminal backends: local, Docker, SSH, Modal, Daytona, Vercel Sandbox | repo root, `README.md` | A dedicated worker is a supported, documented deployment target |
| Outbound relay | `gateway/relay/` implements a **Relay↔Connector contract v1 (experimental)**: gateway dials **out** to a connector over WSS, receives inbound frames on the same socket; **no inbound port required** | `website/docs/developer-guide/relay-connector-contract.md` | Exactly the shape AETHER needs for a mobile client behind NAT — but note *experimental* |
| Providers | Nous Portal, OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, Groq, Ollama, HF, custom endpoints; provider fallback support; per-session model/provider overrides with validation | `README.md`, `user-guide/features/fallback-providers.md`, `providers/` | Provider Manager maps 1:1 to real config; model lists fetched live |
| Google Workspace | **Existing official skill** (`skills/productivity/google-workspace/`) covering Gmail, Calendar, Drive, Sheets, Docs via OAuth2 + refresh; prefers `gws` CLI | `website/docs/user-guide/skills/` | Integrations Hub can drive a real, maintained integration instead of reimplementing Gmail |
| MCP | Local stdio and remote HTTP MCP servers, per-server tool filtering | `user-guide/features/mcp.md` | Custom integrations = MCP config, not bespoke HTTP glue |
| ACP | `hermes-acp` speaks the Agent Client Protocol over stdio (VS Code/Zed/JetBrains) | `acp_adapter/`, `acp-internals.md` | Not the right transport for Android (stdio); keep as optional desktop path |
| Tool approvals | Permission/approval flows exist in gateway session server-requests (edit approval, elicitation, sudo/vault prompts) | `acp_adapter/`, `gateway/session_*` | App can render real approval prompts rather than a fake modal |

**Conclusion:** Hermes is far more capable than "a CLI you shell into". The correct integration is a **long-lived Hermes gateway process** exposing WSS JSON-RPC + a relay, with the Flutter app as a first-class client. That also makes "Resume Agent" a *session* concept, not a container restart.

### 3.3 GitHub: authentication model

| Topic | Current finding | Source | Impact |
|---|---|---|---|
| GitHub App identity | User-to-server token (`ghu_`), **8 h expiry**, refresh token **6 months**; token permissions = intersection of app permissions and what the user can access; `scope` in the response is always empty | docs.github.com — Generating a user access token for a GitHub App | Fine-grained, least privilege |
| Device flow | Supported for **both** GitHub Apps and OAuth Apps; must be enabled in app settings; needs **only `client_id`**; 15-min code, 5-s poll interval; RFC 8628 | same doc + authorizing OAuth apps | **Ideal for mobile**: no secret in the APK |
| PKCE | Supported and "strongly recommended"; **S256 only** (`plain` rejected) | docs.github.com authorizing OAuth apps | Use PKCE on any browser-redirect flow |
| Web app flow secret | Exchanging `code` for a GitHub App user token requires `client_id` **and `client_secret`** | same doc | **Needs a server-side token broker** if used |
| Installation tokens | Installation access token ≈ **1 h**, requires App private key (JWT) | docs.github.com — authenticating as a GitHub App installation | Private key must live server-side only |
| Repo creation | `POST /user/repos` / org repos accept GitHub App user tokens, but need **"Administration" (write)** or **"Repository creation" (write)** | docs.github.com REST repos | Broad permission → **avoid**; use a pre-filled `github.com/new` link + verify afterwards |
| Workflow dispatch | Requires **Actions (write)**; workflow must exist on the default branch | docs.github.com REST actions | Needed for orchestration |
| Contents API | Read/write repo files, 100 MB/file limit; commits can be batched | docs.github.com REST | Snapshot transport |
| OAuth App scopes | Classic: `repo` (full control of private repos), `workflow`, `read:user`; tokens non-expiring unless "expiring tokens" enabled | docs.github.com scopes | Broad, all-or-nothing |
| Revocation | GitHub App: uninstall + token revocation; user can restrict to selected repos | docs.github.com | Strong advantage for App |

### 3.4 GitHub Actions: limits, billing, policy

| Topic | Current finding | Source | Impact |
|---|---|---|---|
| Job execution time | **6 h** per job (GitHub-hosted); self-hosted **5 days**; queue 24 h self-hosted; workflow run 35 days | docs.github.com/actions/reference/limits | 5 h session fits the *technical* ceiling |
| Default timeout | `timeout-minutes` default 360; step max 360 | workflow syntax | Must set explicit deadline below the ceiling |
| Billing | Private repos draw from included compute; **public repos and self-hosted runners are free**; ~$0.06 per 10 Linux minutes after that | docs.github.com billing | A 5 h session ≈ 300 min ≈ **6–7 sessions/month** on Free's 2,000 min if private |
| Network model | Hosted runners are ephemeral VMs; multi-cloud AWS/Azure; no inbound service exposure, no static IP | docs.github.com GitHub-hosted runners | App cannot dial *in*; only outbound relay could work |
| **Acceptable use** | Terms (effective 2026-08-27) forbid, for GitHub-hosted runners, *"any other activity unrelated to the production, testing, deployment, or publication of the software project associated with the repository where GitHub Actions are used"*; also forbid using Actions *"as part of a serverless application"* and burdens *"disproportionate to the benefits provided to users"* | docs.github.com Terms for Additional Products → Actions | **BLOCKER.** An interactive personal agent is unrelated activity → not permitted |
| Enforcement | GitHub may monitor, terminate jobs, restrict Actions, disable repos, suspend accounts | same | Real account risk, not theoretical |

**Verdict:** the 5-hour *product* lifecycle is fine; the *hosting* is not. Shipping AETHER on GitHub-hosted runners would violate the terms the pack told us to verify. The pack anticipated exactly this and requires me to stop and ask (`01` §G, `05` "Critical feasibility caveat", `README` reality checks).

### 3.5 AI providers

| Provider | Interface | Model discovery | Notes |
|---|---|---|---|
| OpenRouter | OpenAI-compatible; `/api/v1/models` returns pricing + context | Live catalog; `:free` variants exist, rate-limited, change often | Free labels must carry source + timestamp; never a hardcoded list |
| OpenAI API | `/v1/chat/completions`, `/v1/models` | Live | ChatGPT/Plus subscription ≠ API credit — must be stated in UI |
| Anthropic | `/v1/messages`, `/v1/models` | Live | Distinct tool-use schema |
| Google Gemini | `generativelanguage` REST | Live | Separate key from Google Workspace OAuth |
| DeepSeek / Groq | OpenAI-compatible | `/models` | Groq is fast-inference |
| Ollama | Local `/api/tags`, OpenAI-compatible `/v1` | Local | Needs reachable endpoint — phone cannot reach `localhost` of the worker; worker-side only |
| Hugging Face | Inference providers router (OpenAI-compatible) | `/v1/models` | Endpoint/provider selection matters |
| Custom | Any OpenAI-compatible base URL | Optional | Must warn on non-TLS base URLs |

Rules adopted: keys never leave the device except to the chosen provider **or** to your own worker over TLS; keys never enter Git, logs, crash reports, or snapshots; "free" is a live-metadata claim with a timestamp; quota/rate-limit surfaced only when the API reports it.

### 3.6 Google, Telegram, Colab

| Integration | Finding | Impact |
|---|---|---|
| Google OAuth (Android) | Android OAuth clients use package name + SHA-1; **no client secret** in the app | Good: no secret to embed |
| Scope tiers | `drive.file` = non-sensitive; `gmail.send`, `calendar` = sensitive (verification, ~2–6 weeks, 100-user cap while "Testing"); `gmail.readonly`, `drive.readonly`, `mail.google.com` = **restricted** (+ CASA security assessment, annual) | Start with `drive.file`, `calendar.events`, `gmail.send` + drafts. Gmail **read** must be marked *blocked pending verification*, not faked |
| Telegram | Bot API, bot token | Straightforward; token is a secret |
| Google Colab | No public API to control notebook runtimes | Only export/import + Drive-backed workflow, exactly as the spec permits |

### 3.7 Persistence & session design (verified against Hermes)

- **Checkpoint primitive:** `hermes backup` → encrypted archive (`age`/libsodium, key derived from a user passphrase or a device-held key) → commit to `aether/backups/<session-id>/` **manifest-last**, then read back the commit SHA and file hash. Only a verified read-back sets `Saved`.
- **Restore:** clone/pull private repo → decrypt → `hermes backup restore` → health check → only then `Running`.
- **Never** commit: API keys, OAuth tokens, private keys, session cookies, unencrypted personal files.
- **Batching:** checkpoint on idle boundaries / explicit save / T-10 min — never per token.
- **Concurrency:** one active session per workspace, enforced by a lock record in the repo + Hermes host lock + workflow `concurrency` group (when Actions is used for orchestration).
- **5-hour lifecycle:** app-owned deadline (default 5 h, warn at T-10 min) → checkpoint → verify → graceful stop → `Stopped`; Resume → new session → restore last verified checkpoint. With a dedicated worker this is a supervised process restart; with Actions it would have been a new job.

---

## 4. Feasibility verdict

| Capability | Verdict |
|---|---|
| Flutter Android client, 29 screens, dark premium UI, drawer-only navigation, RTL | **Feasible** |
| Real GitHub login, repo select/create, snapshots, workflow orchestration | **Feasible** (GitHub App recommended) |
| Real Hermes runtime with streaming chat, tools, approvals, memory, skills | **Feasible** on a dedicated worker via gateway JSON-RPC/WSS |
| 5-hour session + checkpoint + Resume Agent | **Feasible** on dedicated compute; **not** on GitHub-hosted runners (policy) |
| Repository-backed persistence of profile/memory/conversations/skills/projects | **Feasible** with encryption + manifest-last + size monitoring |
| Google Drive/Calendar/Sheets/`gmail.send` | **Feasible**, but external users hit Google verification; restricted Gmail read is **gated** behind CASA |
| Google Colab runtime control | **Not feasible** — no supported API; export/import only |
| Guaranteed free models | **Not feasible** — availability/quotas change; live metadata + labels only |
| Compile/test APK in this sandbox | **Not feasible** — toolchain and package network absent; CI/local build required (§9) |

---

## 5. Recommended architecture (pending your hosting decision)

```
┌─────────────────────────────┐        TLS / WSS          ┌──────────────────────────────┐
│  AETHER AI (Flutter Android)│  ───────────────────────► │  AETHER Relay / Token Broker │
│  • onboarding, chat, skills │  ◄─────────────────────── │  (tiny, stateless)           │
│  • providers, approvals     │   JSON-RPC hermes-gateway  │  • GitHub App JWT → IAT      │
│  • session monitor          │                            │  • single-use WS tickets     │
└──────────────┬──────────────┘                            └──────────────┬───────────────┘
               │ GitHub REST (user token, PKCE/device)                     │ outbound WSS
               ▼                                                          ▼
┌─────────────────────────────┐                            ┌──────────────────────────────┐
│ GitHub                       │                            │ Worker (VPS / home / Termux) │
│ • identity, installation     │  workflow_dispatch /       │  • Hermes gateway (pinned)   │
│ • private repo: snapshots    │  deploy / checkpoint       │  • state.db, memory, skills  │
│ • orchestration workflows    │ ◄───────────────────────── │  • provider keys (env only)  │
└─────────────────────────────┘                            └──────────────────────────────┘
               ▲                                                          │
               │ encrypted checkpoints (manifest-last, verified)          │ provider APIs
               └──────────────────────────────────────────────────────────┘
```

Trust boundaries: the device holds only short-lived GitHub tokens + a device key; the broker holds the App private key and client secret; the worker holds provider keys in env/secret store; the repo holds **only** encrypted, non-secret user data.

---

## 6. GitHub App vs GitHub OAuth App — recommendation

**Recommendation: GitHub App**, because AETHER needs repository-scoped, revocable access plus short-lived tokens, and because GitHub Apps support per-repository installation, while OAuth Apps demand classic `repo` (all private repos) and `workflow`.

| Criterion | GitHub App | OAuth App |
|---|---|---|
| Granularity | Per-permission (Contents RW, Actions RW, Metadata R) | Classic scopes, all-or-nothing |
| Repo scope | Installation can be limited to selected repos | All repos the user owns |
| Token lifetime | UAT 8 h + 6-month refresh; IAT 1 h | Non-expiring by default |
| Mobile auth without secret | Device flow (client_id only) | Device flow (client_id only) |
| Code exchange / refresh | Needs client secret → broker | Needs client secret → broker (or device flow only) |
| Repo creation | Requires Administration write (broad) → avoid, use `github.com/new` link | `repo` scope |
| Workflow dispatch | Actions (write) | `repo` + `workflow` |
| Revocation | Uninstall app / revoke token | Revoke token |
| Device on-boarding | Install app → select repos → authorize | Authorize → select repos in-app |
| Verdict | ✅ **Recommended** | ⚠️ Simpler, broader, weaker |

### Key custody (only if GitHub App)
1. **Token broker (recommended)** — a small stateless service you run (Cloudflare Worker / Fly / your VPS) holding the App private key + client secret; it mints 1 h installation tokens and exchanges/refreshes user tokens. The APK holds nothing long-lived.
2. **Device-flow only** — zero server; the app uses `client_id` + device flow, and simply re-authorizes when the 8 h token expires. Fewer moving parts, more re-logins, no installation tokens (so no workflow dispatch via installation — user token covers it with Actions write).

Either way: **no private key, client secret, provider key, or long-lived token ever ships in the APK or the repo.**

---

## 7. What I will build once you decide (unchanged from the pack)

- **Phase 2** design system + navigation drawer + localization (ar/en/fr) + icon/splash from the supplied AETHER art.
- **Phase 3** GitHub auth (App or OAuth), permission review, repo select/create via link + verification, workspace validation.
- **Phase 4** provider manager: live catalogs, masked keys, real connection tests, default/fallback, free-status provenance.
- **Phase 5** real Hermes worker: pinned install, gateway + relay, chat round-trip, tool events, approvals.
- **Phase 6** encrypted snapshots, checkpoint/restore/rollback, session lock, 5-hour lifecycle, Resume Agent.
- **Phase 7** Skills Manager (agentskills.io format, scan-before-enable), Integrations Hub (Google/TELEGRAM/GitHub/MCP), Colab as export/import only.
- **Phase 8** projects, files, timeline, settings, audit.
- **Phase 9** tests, CI, signed release AAB/APK, SHA-256, changelog, known limitations.

Every feature will be labelled **Implemented / Partially implemented / Blocked — reason**. No mocks posing as real.

---

## 8. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Hosting choice (Actions) is policy-prohibited | **Critical** | Gate 1: dedicated compute |
| R2 | Relay contract is marked *experimental* upstream | High | Pin Hermes commit; adapter layer; fallback to OpenAI-compatible API server |
| R3 | Google restricted scopes need verification/CASA | High | Least-privilege scopes; mark Gmail-read as gated |
| R4 | Provider keys in a multi-tenant worker | High | Env/secret store only; per-session isolation; redacted logs |
| R5 | Third-party skills are untrusted code | High | Scan, show risk, explicit approval, sandboxed execution |
| R6 | Repo snapshot growth / GitHub limits | Medium | Batching, compression, retention, size monitor, LFS only after review |
| R7 | Sandbox cannot build APK | Medium | CI-built artifacts + local build docs |
| R8 | Mockup-derived fake data creeping into UI | Medium | Enforce "no sample identity" in tests/QA checklist |
| R9 | Hermes upstream churn | Medium | Pin commit, update ADR + contract tests |

---

## 9. Delivery constraint (disclosed now, not later)

This sandbox has **no Flutter SDK, Dart SDK, JDK, Gradle, or Android SDK**, and outbound access is restricted (no `storage.googleapis.com`, no `pub.dev`). Consequences:

- I can write the complete, compiling-by-construction Flutter project, tests, CI, and worker/relay code here.
- **APK/AAB artifacts must be built by GitHub Actions** (legitimate: building the app's own release) **or on your machine**. I will ship a release workflow that runs `flutter analyze`, `dart format --set-exit-if-changed`, tests, `flutter build apk --release`, `flutter build appbundle`, and emits SHA-256 sums.
- I will not claim a build passed unless CI actually passes.

---

## 10. Decision gates — your input required

**Gate A — Runtime hosting**
- A1 **Dedicated compute** (VPS / home server / Termux on a spare phone / serverless sandbox) running the real Hermes gateway — *recommended, policy-compliant, keeps 5 h lifecycle*.
- A2 **Self-hosted GitHub Actions runner** on your own machine — GitHub-orchestrated, but still your hardware; heavier setup.
- A3 **GitHub-hosted Actions** — *technically fits 6 h, but violates GitHub's Terms*. Requires explicit written acceptance of account risk; I will not build the runtime this way without it.
- A4 **Phone-local runtime (Termux)** — zero cost, but battery/network dependent.

**Gate B — GitHub identity**
- B1 **GitHub App** — *recommended* (least privilege, per-repo install, short-lived tokens).
- B2 **GitHub OAuth App** — simpler, broad `repo`/`workflow` scopes.

**Gate C — Key custody (if B1)** — C1 token broker (recommended) or C2 device-flow only.

Configuration fields, exact creation steps, callback URLs, permissions and public/secret classification are in the companion setup console: **`docs/setup/aether-setup-console.html`**.

> Do **not** paste client secrets, private keys, or tokens into chat. Use the console to generate the non-secret manifest, and place secrets in a git-ignored `.env` / your secret manager / the broker's environment.

---

## 11. Source index (accessed 2026-11-13)

- Flutter release notes — https://docs.flutter.dev/release/release-notes (3.50.0 stable)
- Flutter architecture — https://docs.flutter.dev/app-architecture/guide
- Flutter i18n — https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization
- Flutter Android deployment — https://docs.flutter.dev/deployment/android
- Hermes repo — https://github.com/NousResearch/hermes-agent @ `438008f4`
- Hermes programmatic integration — `website/docs/developer-guide/programmatic-integration.md`
- Hermes API server — `website/docs/user-guide/features/api-server.md`
- Hermes relay contract — `website/docs/developer-guide/relay-connector-contract.md`
- Hermes session storage — `website/docs/developer-guide/session-storage.md`
- Hermes memory — `website/docs/user-guide/features/memory.md`
- Hermes skills — `website/docs/user-guide/features/skills.md`
- Hermes MCP — `website/docs/user-guide/features/mcp.md`
- GitHub Actions limits — https://docs.github.com/en/actions/reference/limits
- GitHub billing — https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub-hosted runners — https://docs.github.com/en/actions/concepts/runners/github-hosted-runners
- GitHub Terms (Actions) — https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
- GitHub App user tokens & device flow — https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- GitHub OAuth authorizing apps (PKCE, device flow) — https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- REST repositories (create repo permissions) — https://docs.github.com/en/rest/repos/repos
- REST workflows (dispatch, Actions write) — https://docs.github.com/en/rest/actions/workflows
- GitHub App permissions — https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps
- Google OAuth / scopes / verification — https://developers.google.com/identity/protocols/oauth2 ; https://support.google.com/cloud/answer/9110914
- Google Workspace APIs — Drive/Gmail/Calendar/Sheets guides (developers.google.com/workspace)
- Colab FAQ — https://research.google.com/colaboratory/faq.html
- Telegram Bot API — https://core.telegram.org/bots/api
- Android Keystore / app links / photo picker — developer.android.com
