import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/aether_theme.dart';
import '../l10n/app_localizations.dart';
import 'router.dart';

class AetherApp extends ConsumerWidget {
  const AetherApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'AETHER AI',
      debugShowCheckedModeBanner: false,
      theme: AetherTheme.dark(),
      routerConfig: router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
