# AETHER AI — documentation

**Product:** AETHER AI — Your Personal Autonomous AI Agent
**Platform:** Flutter / Android first
**Current status:** Phase 3 configuration gate. No application code has been written yet.

## Read in this order

| # | Document | Purpose |
|---|---|---|
| 1 | [`00_RESEARCH_AND_FEASIBILITY.md`](00_RESEARCH_AND_FEASIBILITY.md) | Pack audit, official-source research, feasibility verdict, recommended architecture, risk register, decision gates |
| 2 | [`setup/aether-setup-console.html`](setup/aether-setup-console.html) | Interactive setup console: runtime hosting, GitHub App vs OAuth App, sign-in flow, key custody, generated callback URLs, permissions, non-secret manifest export |
| 3 | [`setup/CONFIGURATION_CHECKLIST.md`](setup/CONFIGURATION_CHECKLIST.md) | Printable field-by-field checklist for creating the GitHub application |
| 4 | [`setup/verify-github-app.sh`](setup/verify-github-app.sh) | Real verification against the GitHub API: App identity, installations, token minting, repository access. Prints no secrets |

## The uploaded development pack

The original archive, `AETHER_AI_Arena_Development_Pack.zip`, stays at the repository root untouched. Extract it for reference:

```bash
unzip -o AETHER_AI_Arena_Development_Pack.zip -d .pack
```

`.pack/` is git-ignored so the 11 MB of images are not duplicated in history.

## Status legend used in all documents

- **Verified** — checked against official documentation or real source code, with date and source recorded.
- **Needs your decision** — blocked on an explicit choice from you.
- **Blocked** — not achievable under current technical or policy constraints; reason stated.
- **Implemented / Partially implemented / Mocked** — used only once code exists. Nothing is currently marked implemented.
