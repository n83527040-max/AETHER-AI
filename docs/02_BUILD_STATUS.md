# AETHER AI — build and verification status

**Last verified:** 2026-11-13 · **Branch:** `arena/eb94c696-aether-ai`

Everything in this document was produced by real CI runs, not by inspection or assumption.

---

## 1. Verified toolchain

| Component | Version | How verified |
|---|---|---|
| Flutter | **3.50.0** stable (framework `ab2912035e`, 2026-11-09) | `flutter --version` in CI |
| Dart | **3.14.0** | `dart --version` in CI |
| Material library | **material_ui 1.11.0** | resolved by `flutter pub get` |
| Android Gradle Plugin | **9.3.1** | version-matched template emitted by CI |
| Gradle | **9.5.0** | version-matched template emitted by CI |
| Kotlin | **2.4.20** | version-matched template emitted by CI |
| JDK | **17** (Temurin) | `actions/setup-java` |
| `minSdk` | **26** (Android 8.0) | `app/android/app/build.gradle.kts` |
| Application ID | **ai.aether.agent** | `app/android/app/build.gradle.kts` |

### Migration note
Flutter 3.50 deprecates `package:flutter/material.dart` in favour of the official
`package:material_ui/material_ui.dart` (Material was moved to a pub package at 3.47).
The app was migrated rather than suppressing the deprecation.

---

## 2. CI result

Run: [`43496092915`](https://github.com/n83527040-max/AETHER-AI/actions/runs/43496092915) — **success**

| Job | Result | What it proves |
|---|---|---|
| Analyze, format and test | ✅ | `dart format --set-exit-if-changed` clean, `flutter analyze` zero issues, **8/8 tests pass** |
| Emit Android template | ✅ | The Android scaffold matches Flutter 3.50.0 exactly (AGP 9.3.1 / Gradle 9.5.0) |
| Build debug APK | ✅ | Debug APK, release APK and release AAB all compile |
| Artifact `aether-build` | 146 MB | APKs + AAB + SHA-256 checksums, retained 14 days |

Artifacts are downloadable from the run page → **Artifacts**. (The sandbox cannot fetch them because
GitHub redirects artifact downloads to `blob.core.windows.net`, which is outside its network allowlist.)

> The release APK is signed with the **debug key** until you supply `android/key.properties`.
> That is intentional and disclosed: the build is installable for testing, not publishable.

---

## 3. Implemented in this build

| Area | State | Notes |
|---|---|---|
| Brand identity | Implemented | Launcher icon (all densities + adaptive foreground), splash artwork, dark theme tokens from the supplied pack |
| Splash screen | Implemented | Animated logo, localized, hands off to welcome |
| Welcome screen | Implemented | Localized (ar/en/fr), RTL-aware, honest capability copy |
| Configuration diagnostics | Implemented | Reads compile-time public values, shows Set/Missing, explains secret placement, copies build flags |
| Localization | Implemented | ARB-based `gen-l10n`, English/Arabic/French, no hardcoded UI strings |
| Android platform | Implemented | `minSdk 26`, `supportsRtl`, `allowBackup=false`, cleartext disabled, `aetherai://oauth/callback` deep link |
| Tests | Implemented | 8 unit/widget tests |
| CI | Implemented | Format, analyze, test, APK, AAB, checksums |

## 4. Not implemented — and not faked

| Area | State |
|---|---|
| GitHub device-flow sign-in | **Not implemented.** The button is deliberately disabled; it does not simulate authentication. |
| Token broker / relay | **Not implemented.** Design in `01_RUNTIME_AND_RELAY_DESIGN.md`; awaiting host approval. |
| Hermes worker + session lifecycle | **Not implemented.** |
| Chat, conversations, memory, projects, files | **Not implemented.** No mock conversations exist in the codebase. |
| Skills Manager, Integrations Hub, AI Providers | **Not implemented.** |
| Session monitor / Resume Agent | **Not implemented.** |

The specification forbids mock functionality; nothing above is represented in the UI as working.

---

## 5. Known warnings (non-blocking)

1. `actions/checkout@v4` and `actions/upload-artifact@v4` emit a Node 20 → Node 24 deprecation notice.
   Cosmetic today; bump action majors when their Node 24 releases settle.
2. `ubuntu-latest` will migrate to Ubuntu 26 from 2026-10-19. No impact on the current build.
3. `flutter_lints 4.0.0` is older than the available 6.0.0; rules are currently clean, upgrade later with a lint pass.

---

## 6. How to install the current build

1. Open the run above → **Artifacts** → `aether-build`.
2. Install `app-release.apk` on an Android 8.0+ device (allow install from unknown sources).
3. The app opens on the AETHER splash → welcome. "Continue with GitHub" is disabled with an
   explanation; **View setup requirements** shows exactly which public values are missing.

---

## 7. Next milestone (after broker approval)

1. Token broker + relay (one small service) with tests.
2. Device-flow sign-in, token storage in Android Keystore, revocation.
3. Repository workspace selection and creation-link verification.
4. Hermes worker workflow, health check, heartbeat, encrypted checkpoint/restore.
5. Chat UI on real gateway JSON-RPC events.
