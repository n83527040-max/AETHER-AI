// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appName => 'AETHER AI';

  @override
  String get tagline => 'وكيلك الشخصي المستقل للذكاء الاصطناعي';

  @override
  String get splashLoading => 'جارٍ تجهيز مساحة العمل';

  @override
  String get welcomeHeadline => 'وكيل شخصي يتذكّر';

  @override
  String get welcomeBody =>
      'يربط AETHER جهاز أندرويد بوكيل Hermes يخطّط المهام ويستخدم المهارات ويحفظ ذاكرة منسّقة ويستعيد حالته عند استئناف الجلسة.';

  @override
  String get continueWithGithub => 'المتابعة عبر GitHub';

  @override
  String get signInLocked =>
      'تسجيل الدخول عبر GitHub معطّل حتى يتم ضبط التطبيق بمعرّف العميل الخاص بتطبيق GitHub.';

  @override
  String get viewSetupRequirements => 'عرض متطلبات الإعداد';

  @override
  String get configTitle => 'الإعداد مطلوب';

  @override
  String get configIntro =>
      'تُضمَّن هذه المعرّفات العامة في التطبيق وقت البناء. لا تُخزَّن أي أسرار في ملف APK.';

  @override
  String get configSet => 'مضبوط';

  @override
  String get configMissing => 'مفقود';

  @override
  String get configPublic => 'عام';

  @override
  String get configCopyCommand => 'نسخ أمر البناء';

  @override
  String get configCopied => 'تم نسخ أمر البناء';

  @override
  String get configSecretsNote =>
      'تبقى أسرار العميل والمفاتيح الخاصة ومفاتيح مزوّدي الخدمة على الوسيط والعامل فقط، ولا تُشحن أبدًا داخل التطبيق.';

  @override
  String get backToWelcome => 'رجوع';

  @override
  String get signInNotYetAvailable =>
      'تسجيل الدخول غير متاح في هذا الإصدار بعد. تم إنجاز الأساس والهوية وفحوص الإعداد.';

  @override
  String get capabilityMemory => 'ذاكرة منسّقة تبقى بين الجلسات';

  @override
  String get capabilityCheckpoints => 'نقاط استعادة مشفّرة داخل مستودعك الخاص';

  @override
  String get capabilityTools => 'أدوات ومهارات وتكاملات Hermes بموافقتك';

  @override
  String get configWhereToGet =>
      'إعدادات تطبيق GitHub ← About. أما روابط الوسيط والعامل فأنت من يحددها.';
}
