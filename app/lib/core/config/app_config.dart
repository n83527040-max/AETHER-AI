import 'package:flutter/foundation.dart';

/// Public, compile-time configuration.
///
/// Secrets are deliberately absent: client secrets, private keys and provider
/// API keys live on the token broker and the worker, never in the APK.
@immutable
class AppConfig {
  const AppConfig._();

  static const String githubClientId =
      String.fromEnvironment('AETHER_GH_CLIENT_ID');
  static const String githubAppSlug =
      String.fromEnvironment('AETHER_GH_APP_SLUG');
  static const String brokerBaseUrl =
      String.fromEnvironment('AETHER_BROKER_URL');
  static const String workerEndpoint =
      String.fromEnvironment('AETHER_WORKER_URL');

  /// Accepts a value only when it is present and is not an obvious placeholder.
  static bool isUsable(String value, {required int minLength}) {
    final String v = value.trim();
    if (v.length < minLength) {
      return false;
    }
    final String upper = v.toUpperCase();
    if (upper.startsWith('YOUR_') ||
        upper.contains('<') ||
        upper.contains('>') ||
        upper == 'CHANGEME') {
      return false;
    }
    return true;
  }

  static bool get hasGithubClientId => isUsable(githubClientId, minLength: 10);

  static bool get hasBrokerUrl =>
      isUsable(brokerBaseUrl, minLength: 12) &&
      brokerBaseUrl.startsWith('https://');

  static bool get isGithubSignInReady => hasGithubClientId && hasBrokerUrl;

  static List<ConfigField> get fields => <ConfigField>[
        ConfigField(
          key: 'AETHER_GH_CLIENT_ID',
          label: 'GitHub App Client ID',
          value: githubClientId,
          isSet: hasGithubClientId,
          isRequired: true,
          description:
              'Public identifier from your GitHub App settings. Required for device flow.',
        ),
        ConfigField(
          key: 'AETHER_GH_APP_SLUG',
          label: 'GitHub App slug',
          value: githubAppSlug,
          isSet: isUsable(githubAppSlug, minLength: 3),
          isRequired: false,
          description:
              'Public slug used in installation links and diagnostics.',
        ),
        ConfigField(
          key: 'AETHER_BROKER_URL',
          label: 'Token broker base URL',
          value: brokerBaseUrl,
          isSet: hasBrokerUrl,
          isRequired: true,
          description:
              'HTTPS endpoint of your broker. Mints short-lived installation tokens.',
        ),
        ConfigField(
          key: 'AETHER_WORKER_URL',
          label: 'Worker endpoint',
          value: workerEndpoint,
          isSet: isUsable(workerEndpoint, minLength: 8),
          isRequired: false,
          description:
              'WSS endpoint of the relay the agent session connects through.',
        ),
      ];

  static String get buildCommand => <String>[
        'flutter build apk --release \\',
        '  --dart-define=AETHER_GH_CLIENT_ID=<client-id> \\',
        '  --dart-define=AETHER_GH_APP_SLUG=<app-slug> \\',
        '  --dart-define=AETHER_BROKER_URL=<https-broker-url> \\',
        '  --dart-define=AETHER_WORKER_URL=<wss-worker-url>',
      ].join('\n');
}

@immutable
class ConfigField {
  const ConfigField({
    required this.key,
    required this.label,
    required this.value,
    required this.isSet,
    required this.isRequired,
    required this.description,
  });

  final String key;
  final String label;
  final String value;
  final bool isSet;
  final bool isRequired;
  final String description;

  bool get isPublic => true;
}
