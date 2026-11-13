import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/l10n.dart';
import '../../core/theme/aether_colors.dart';
import '../../core/widgets/aether_background.dart';
import '../../core/widgets/aether_logo.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    )..forward();
    _timer = Timer(const Duration(milliseconds: 1800), _continueToWelcome);
  }

  void _continueToWelcome() {
    if (!mounted) {
      return;
    }
    context.go('/welcome');
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final CurvedAnimation curve = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );

    return Scaffold(
      body: AetherBackground(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: <Widget>[
              const Spacer(flex: 3),
              FadeTransition(
                opacity: curve,
                child: ScaleTransition(
                  scale: Tween<double>(begin: 0.92, end: 1).animate(curve),
                  child: Column(
                    children: <Widget>[
                      const AetherLogo(size: 118),
                      const SizedBox(height: 30),
                      Text(
                        context.l10n.appName,
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  letterSpacing: 6,
                                ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        context.l10n.tagline,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AetherColors.textMuted,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(flex: 3),
              SizedBox(
                width: 132,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: const LinearProgressIndicator(minHeight: 3),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                context.l10n.splashLoading,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }
}
