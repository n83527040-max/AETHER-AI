# ADR-001 — Runtime host, GitHub identity, sign-in flow and key custody

- **Status:** Accepted by owner (2026-11-13), with a recorded policy exception
- **Supersedes:** the recommendation in `00_RESEARCH_AND_FEASIBILITY.md` §10 (Gate A1 → A3)
- **Related:** `docs/01_RUNTIME_AND_RELAY_DESIGN.md`, `docs/setup/aether-setup-console.html`

## Context

Research (`00_RESEARCH_AND_FEASIBILITY.md` §3.4) established:

1. A GitHub-hosted runner job may run for **6 hours**, so a 5-hour product session fits the technical ceiling.
2. GitHub's Terms for Additional Products and Features forbid using GitHub-hosted runners for *"any other activity unrelated to the production, testing, deployment, or publication of the software project associated with the repository where GitHub Actions are used"*, and forbid using Actions *"as part of a serverless application"*.
3. Hosted runners are ephemeral and cannot accept inbound connections.

The owner reviewed these findings and explicitly chose to proceed on GitHub-hosted Actions anyway.

## Decision

| Dimension | Decision | Owner's instruction |
|---|---|---|
| Runtime host | **GitHub-hosted Actions** (option A3) | *"I explicitly choose GitHub-hosted GitHub Actions as the full runtime environment… with the full 5-hour session, persistent checkpoints, automatic state saving, and Resume Agent… I understand the risks and GitHub's usage restrictions. I accept responsibility for this choice."* |
| GitHub identity | **GitHub App** (B1) | Selected in the setup console |
| Sign-in flow | **Device flow** (F1) | Selected in the setup console |
| Key custody | **Token broker** (C1) | *"Keep all GitHub App private keys and client secrets server-side, never inside the APK or repository."* |
| Build artifacts | **CI-built APK/AAB** | Selected in the setup console |
| Hosting changes | **Not permitted without written approval** | *"do not switch to VPS, dedicated compute, or another hosting solution without my permission."* |

## Consequences

### Accepted by the owner
- Policy risk: GitHub may terminate jobs, restrict Actions, disable the repository, or suspend the account.
- Cost: a 5-hour session consumes **300 Actions minutes**. On GitHub Free (2,000 included private-repo minutes) that is ~6 sessions per month; on Pro/Team (3,000) ~10. Beyond the included amount, Linux list pricing applies (verify current rate in GitHub billing docs).
- Cold start: every Resume requires a new runner, dependency install, and state restore.
- Ephemeral disk: any state not committed to the repository is lost.

### Engineering mitigations (mandatory in the design)
1. **Outbound-only relay.** The runner never listens for inbound traffic; it dials out over WSS to the relay. The app talks to the relay, never to the runner.
2. **Bounded blast radius.** One active session per workspace, enforced by a repository lock record, Hermes host lock, and workflow `concurrency` group.
3. **5-hour app deadline with a 6-hour platform ceiling.** Job timeout is set below 360 minutes; an internal timer stops the agent at 5 hours, checkpoints at T-10, and exits before the ceiling.
4. **Frequent checkpoints.** Periodic encrypted snapshots (default every 10 minutes) bound worst-case loss to one interval if the runner is killed.
5. **No commercial service.** The runtime serves one owner and one private repository, which is the least aggressive form of the chosen pattern.
6. **Host adapter seam.** The worker supervisor is written behind an `ExecutionHost` interface with a single `GitHubActionsHost` implementation active. Switching hosts later must be a configuration change plus an approved ADR — never a silent rewrite.
7. **Honest UI.** Session states come from verified signals (workflow run status, heartbeat, checkpoint commit SHA). The app never displays "Running" without a health check.

## Compliance statement

This application will be presented to its owner as operating on a host that GitHub's terms restrict for this workload. The limitation is disclosed in:

- this ADR,
- the app's Settings → About → Runtime disclosure,
- `docs/01_RUNTIME_AND_RELAY_DESIGN.md` §7.

No document or UI will describe GitHub-hosted Actions as an officially supported agent host.

## Revisit triggers

Re-open this decision if any of the following occurs:

- GitHub restricts the repository's Actions or issues a policy notice.
- Session cold-start consistently exceeds 3 minutes.
- Monthly minutes exceed the plan's included amount.
- Hermes' relay contract changes incompatibly.
- The owner requests a host change in writing (then: new ADR, adapter switch, regression test).
