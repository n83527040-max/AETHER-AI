import 'package:material_ui/material_ui.dart';

import '../theme/aether_colors.dart';

class AetherLogo extends StatelessWidget {
  const AetherLogo({super.key, this.size = 96, this.withGlow = true});

  final double size;
  final bool withGlow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.24),
        boxShadow: withGlow
            ? <BoxShadow>[
                BoxShadow(
                  color: AetherColors.violet.withValues(alpha: 0.45),
                  blurRadius: size * 0.42,
                  spreadRadius: size * 0.02,
                ),
              ]
            : null,
      ),
      child: Image.asset(
        'assets/brand/aether_icon.png',
        width: size,
        height: size,
        filterQuality: FilterQuality.high,
        semanticLabel: 'AETHER AI',
      ),
    );
  }
}
