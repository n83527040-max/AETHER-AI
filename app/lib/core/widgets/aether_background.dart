import 'package:flutter/material.dart';

import '../theme/aether_colors.dart';

/// Deep navy canvas with the restrained violet/cyan glow from the brand boards.
class AetherBackground extends StatelessWidget {
  const AetherBackground({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[
            Color(0xFF0A0C16),
            AetherColors.background,
            Color(0xFF05060B),
          ],
          stops: <double>[0.0, 0.55, 1.0],
        ),
      ),
      child: Stack(
        children: <Widget>[
          const Positioned(
            top: -110,
            right: -90,
            child: _Glow(color: AetherColors.violet, size: 320, opacity: 0.22),
          ),
          const Positioned(
            bottom: -140,
            left: -110,
            child: _Glow(color: AetherColors.cyan, size: 300, opacity: 0.10),
          ),
          Positioned.fill(
            child: Padding(
              padding: padding ?? EdgeInsets.zero,
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow({
    required this.color,
    required this.size,
    required this.opacity,
  });

  final Color color;
  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: <Color>[
              color.withValues(alpha: opacity),
              color.withValues(alpha: 0.0),
            ],
          ),
        ),
      ),
    );
  }
}
