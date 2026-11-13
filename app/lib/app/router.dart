import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/setup/config_requirements_screen.dart';
import '../features/splash/splash_screen.dart';
import '../features/welcome/welcome_screen.dart';

final Provider<GoRouter> routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/splash',
    routes: <RouteBase>[
      GoRoute(
        path: '/splash',
        builder: (_, __) => const SplashScreen(),
      ),
      GoRoute(
        path: '/welcome',
        pageBuilder: (_, __) => const NoTransitionPage<void>(
          child: WelcomeScreen(),
        ),
      ),
      GoRoute(
        path: '/setup/config',
        builder: (_, __) => const ConfigRequirementsScreen(),
      ),
    ],
  );
});
