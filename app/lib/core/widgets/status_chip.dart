import 'package:flutter/material.dart';

import '../theme/aether_colors.dart';

enum StatusTone { positive, negative, neutral }

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.tone = StatusTone.neutral,
  });

  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final Color color = switch (tone) {
      StatusTone.positive => AetherColors.success,
      StatusTone.negative => AetherColors.danger,
      StatusTone.neutral => AetherColors.textMuted,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.38)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.02,
          color: color,
        ),
      ),
    );
  }
}
