import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/aether_colors.dart';
import '../../core/widgets/aether_background.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/status_chip.dart';

class ConfigRequirementsScreen extends StatelessWidget {
  const ConfigRequirementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final List<ConfigField> fields = AppConfig.fields;

    return Scaffold(
      body: AetherBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: <Widget>[
              Row(
                children: <Widget>[
                  IconButton(
                    onPressed: () => context.go('/welcome'),
                    icon: const Icon(Icons.arrow_back),
                    tooltip: context.l10n.backToWelcome,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      context.l10n.configTitle,
                      style: theme.textTheme.headlineSmall,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(context.l10n.configIntro, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 20),
              for (final ConfigField field in fields) ...<Widget>[
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              field.label,
                              style: theme.textTheme.titleMedium,
                            ),
                          ),
                          StatusChip(
                            label: field.isSet
                                ? context.l10n.configSet
                                : context.l10n.configMissing,
                            tone: field.isSet
                                ? StatusTone.positive
                                : field.isRequired
                                    ? StatusTone.negative
                                    : StatusTone.neutral,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SelectableText(
                        field.value.isEmpty ? '—' : field.value,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: AetherColors.textMuted,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(field.description, style: theme.textTheme.bodySmall),
                      const SizedBox(height: 10),
                      Row(
                        children: <Widget>[
                          Text(
                            field.key,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 10.5,
                              color: AetherColors.textDim,
                            ),
                          ),
                          const SizedBox(width: 8),
                          StatusChip(
                            label: context.l10n.configPublic,
                            tone: StatusTone.neutral,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              GlassCard(
                borderColor: AetherColors.warning.withValues(alpha: 0.35),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Icon(
                      Icons.lock_outline,
                      size: 18,
                      color: AetherColors.warning,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        context.l10n.configSecretsNote,
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text('Build flags', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              GlassCard(
                child: SelectableText(
                  AppConfig.buildCommand,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11.5,
                    height: 1.6,
                    color: AetherColors.textMuted,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: () async {
                  await Clipboard.setData(
                    ClipboardData(text: AppConfig.buildCommand),
                  );
                  if (!context.mounted) {
                    return;
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(context.l10n.configCopied)),
                  );
                },
                icon: const Icon(Icons.copy_all_outlined, size: 18),
                label: Text(context.l10n.configCopyCommand),
              ),
              const SizedBox(height: 16),
              Text(context.l10n.configWhereToGet, style: theme.textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}
