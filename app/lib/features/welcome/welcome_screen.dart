import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/aether_colors.dart';
import '../../core/widgets/aether_background.dart';
import '../../core/widgets/aether_logo.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/primary_button.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bool configured = AppConfig.isGithubSignInReady;

    return Scaffold(
      body: AetherBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    const AetherLogo(size: 34, withGlow: false),
                    const SizedBox(width: 12),
                    Text(
                      context.l10n.appName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            letterSpacing: 3,
                          ),
                    ),
                  ],
                ),
                const Spacer(flex: 2),
                Text(
                  context.l10n.welcomeHeadline,
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 16),
                Text(
                  context.l10n.welcomeBody,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AetherColors.textMuted,
                      ),
                ),
                const SizedBox(height: 24),
                GlassCard(
                  child: Column(
                    children: <Widget>[
                      _Capability(
                        icon: Icons.psychology_outlined,
                        label: context.l10n.capabilityMemory,
                      ),
                      const SizedBox(height: 16),
                      _Capability(
                        icon: Icons.inventory_2_outlined,
                        label: context.l10n.capabilityCheckpoints,
                      ),
                      const SizedBox(height: 16),
                      _Capability(
                        icon: Icons.hub_outlined,
                        label: context.l10n.capabilityTools,
                      ),
                    ],
                  ),
                ),
                const Spacer(flex: 3),
                PrimaryButton(
                  label: context.l10n.continueWithGithub,
                  icon: Icons.login,
                  // Sign-in is enabled once the device-flow implementation and
                  // the broker are in place. Until then the control stays
                  // disabled rather than pretending to authenticate.
                  onPressed: null,
                ),
                const SizedBox(height: 12),
                Text(
                  configured
                      ? context.l10n.signInNotYetAvailable
                      : context.l10n.signInLocked,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 4),
                Center(
                  child: TextButton(
                    onPressed: () => context.go('/setup/config'),
                    child: Text(context.l10n.viewSetupRequirements),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Capability extends StatelessWidget {
  const _Capability({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AetherColors.violet.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: AetherColors.border),
          ),
          child: Icon(icon, size: 19, color: AetherColors.violetSoft),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AetherColors.text,
                  ),
            ),
          ),
        ),
      ],
    );
  }
}
