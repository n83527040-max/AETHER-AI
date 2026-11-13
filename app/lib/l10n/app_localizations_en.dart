// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'AETHER AI';

  @override
  String get tagline => 'Your Personal Autonomous AI Agent';

  @override
  String get splashLoading => 'Preparing your workspace';

  @override
  String get welcomeHeadline => 'A personal agent that remembers';

  @override
  String get welcomeBody =>
      'AETHER connects your Android device to a Hermes agent that plans tasks, uses skills, keeps curated memory, and restores its state when a session resumes.';

  @override
  String get continueWithGithub => 'Continue with GitHub';

  @override
  String get signInLocked =>
      'GitHub sign-in is locked until the app is configured with your GitHub App Client ID.';

  @override
  String get viewSetupRequirements => 'View setup requirements';

  @override
  String get configTitle => 'Configuration required';

  @override
  String get configIntro =>
      'These public identifiers are compiled into the app at build time. No secret is ever stored in the APK.';

  @override
  String get configSet => 'Set';

  @override
  String get configMissing => 'Missing';

  @override
  String get configPublic => 'Public';

  @override
  String get configCopyCommand => 'Copy build command';

  @override
  String get configCopied => 'Build command copied';

  @override
  String get configSecretsNote =>
      'Client secrets, private keys and provider API keys live only on your broker and worker. They are never shipped in the application.';

  @override
  String get backToWelcome => 'Back';

  @override
  String get signInNotYetAvailable =>
      'Sign-in is not available in this build yet. The foundation, brand and configuration checks are in place.';

  @override
  String get capabilityMemory =>
      'Curated memory that survives between sessions';

  @override
  String get capabilityCheckpoints =>
      'Encrypted checkpoints stored in your private repository';

  @override
  String get capabilityTools =>
      'Hermes tools, skills and integrations under your approval';

  @override
  String get configWhereToGet =>
      'GitHub App settings → About. Broker and worker URLs are yours to define.';
}
