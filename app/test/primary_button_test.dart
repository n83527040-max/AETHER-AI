import 'package:aether_ai/core/theme/aether_theme.dart';
import 'package:aether_ai/core/widgets/primary_button.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders its label and reports taps', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: AetherTheme.dark(),
        home: Scaffold(
          body: PrimaryButton(
            label: 'Continue with GitHub',
            onPressed: () => taps++,
          ),
        ),
      ),
    );

    expect(find.text('Continue with GitHub'), findsOneWidget);

    await tester.tap(find.byType(PrimaryButton));
    await tester.pump();

    expect(taps, 1);
  });

  testWidgets('is disabled when no callback is provided', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AetherTheme.dark(),
        home: const Scaffold(
          body: PrimaryButton(label: 'Locked', onPressed: null),
        ),
      ),
    );

    final FilledButton button = tester.widget<FilledButton>(
      find.byType(FilledButton),
    );
    expect(button.onPressed, isNull);
  });

  testWidgets('shows a spinner instead of the icon while loading',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AetherTheme.dark(),
        home: Scaffold(
          body: PrimaryButton(
            label: 'Working',
            isLoading: true,
            icon: Icons.login,
            onPressed: () {},
          ),
        ),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byIcon(Icons.login), findsNothing);
  });
}
