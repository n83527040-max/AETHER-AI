import 'package:material_ui/material_ui.dart';

import 'aether_colors.dart';

abstract final class AetherTheme {
  static ThemeData dark() {
    const ColorScheme scheme = ColorScheme.dark(
      primary: AetherColors.violet,
      onPrimary: Colors.white,
      secondary: AetherColors.cyan,
      onSecondary: Color(0xFF04121A),
      surface: AetherColors.surface,
      onSurface: AetherColors.text,
      error: AetherColors.danger,
      onError: Colors.white,
    );

    const TextTheme text = TextTheme(
      headlineLarge: TextStyle(
        fontSize: 30,
        fontWeight: FontWeight.w600,
        height: 1.18,
        letterSpacing: -0.6,
        color: AetherColors.text,
      ),
      headlineSmall: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        height: 1.25,
        letterSpacing: -0.2,
        color: AetherColors.text,
      ),
      titleLarge: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AetherColors.text,
      ),
      titleMedium: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: AetherColors.text,
      ),
      bodyLarge: TextStyle(
        fontSize: 16,
        height: 1.55,
        color: AetherColors.text,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        height: 1.5,
        color: AetherColors.textMuted,
      ),
      bodySmall: TextStyle(
        fontSize: 12.5,
        height: 1.45,
        color: AetherColors.textDim,
      ),
      labelLarge: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: AetherColors.text,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: AetherColors.background,
      canvasColor: AetherColors.background,
      textTheme: text,
      dividerColor: AetherColors.border,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.04,
          color: AetherColors.text,
        ),
        iconTheme: IconThemeData(color: AetherColors.text),
      ),
      iconTheme: const IconThemeData(color: AetherColors.textMuted),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          backgroundColor: AetherColors.violet,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AetherColors.surfaceHigh,
          disabledForegroundColor: AetherColors.textDim,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AetherColors.violetSoft,
          minimumSize: const Size(48, 48),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AetherColors.surfaceHigh,
        contentTextStyle: TextStyle(color: AetherColors.text),
        behavior: SnackBarBehavior.floating,
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: AetherColors.surface,
        surfaceTintColor: Colors.transparent,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AetherColors.violet,
        linearTrackColor: Color(0xFF1B2036),
      ),
    );
  }
}
