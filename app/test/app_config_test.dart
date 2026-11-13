import 'package:aether_ai/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppConfig.isUsable', () {
    test('rejects empty values', () {
      expect(AppConfig.isUsable('', minLength: 10), isFalse);
    });

    test('rejects obvious placeholders', () {
      expect(AppConfig.isUsable('YOUR_CLIENT_ID', minLength: 10), isFalse);
      expect(AppConfig.isUsable('<client-id>', minLength: 10), isFalse);
      expect(AppConfig.isUsable('changeme', minLength: 5), isFalse);
    });

    test('accepts a realistic client id', () {
      expect(
        AppConfig.isUsable('Iv1.0123456789abcdef', minLength: 10),
        isTrue,
      );
    });
  });

  test('an unconfigured build is not sign-in ready', () {
    expect(AppConfig.hasGithubClientId, isFalse);
    expect(AppConfig.isGithubSignInReady, isFalse);
  });

  test('required configuration fields are declared', () {
    final requirements = AppConfig.fields;
    expect(requirements, isNotEmpty);
    expect(
      requirements.where((f) => f.isRequired).map((f) => f.key),
      containsAll(<String>['AETHER_GH_CLIENT_ID', 'AETHER_BROKER_URL']),
    );
  });
}
