# AETHER AI — Flutter application

**Status:** Phase 2 foundation. Splash, welcome and configuration diagnostics are implemented.
GitHub sign-in, chat, skills, providers and sessions are not implemented yet and are not simulated anywhere.

## Requirements

- Flutter **3.50.0** (stable) with bundled Dart
- Android SDK, JDK 17
- Android `minSdk 26` (Android 8.0) once the platform folder is generated

## Run

```bash
flutter pub get
flutter gen-l10n
flutter run \
  --dart-define=AETHER_GH_CLIENT_ID=<client-id> \
  --dart-define=AETHER_GH_APP_SLUG=<app-slug> \
  --dart-define=AETHER_BROKER_URL=<https-broker-url> \
  --dart-define=AETHER_WORKER_URL=<wss-worker-url>
```

All four values are **public**. Secrets belong to the token broker and worker; the app never contains one.

## Verify

```bash
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --release
```

CI (`.github/workflows/app-ci.yml`) runs the same checks. The Android platform folder is added from the
version-matched template emitted by the `android-template` job, then customised for the AETHER icon,
deep-link callback and `minSdk`.

## What is intentionally absent in this build

- The "Continue with GitHub" control is disabled: the device-flow client and broker are a later milestone.
  It is not a placeholder screen that pretends to sign in.
- No API key is requested or stored on the device.
- No mock conversation, mock skills or mock provider data exists in the codebase.
