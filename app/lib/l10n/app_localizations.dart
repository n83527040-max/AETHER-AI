import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';
import 'app_localizations_fr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
    Locale('fr')
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'AETHER AI'**
  String get appName;

  /// No description provided for @tagline.
  ///
  /// In en, this message translates to:
  /// **'Your Personal Autonomous AI Agent'**
  String get tagline;

  /// No description provided for @splashLoading.
  ///
  /// In en, this message translates to:
  /// **'Preparing your workspace'**
  String get splashLoading;

  /// No description provided for @welcomeHeadline.
  ///
  /// In en, this message translates to:
  /// **'A personal agent that remembers'**
  String get welcomeHeadline;

  /// No description provided for @welcomeBody.
  ///
  /// In en, this message translates to:
  /// **'AETHER connects your Android device to a Hermes agent that plans tasks, uses skills, keeps curated memory, and restores its state when a session resumes.'**
  String get welcomeBody;

  /// No description provided for @continueWithGithub.
  ///
  /// In en, this message translates to:
  /// **'Continue with GitHub'**
  String get continueWithGithub;

  /// No description provided for @signInLocked.
  ///
  /// In en, this message translates to:
  /// **'GitHub sign-in is locked until the app is configured with your GitHub App Client ID.'**
  String get signInLocked;

  /// No description provided for @viewSetupRequirements.
  ///
  /// In en, this message translates to:
  /// **'View setup requirements'**
  String get viewSetupRequirements;

  /// No description provided for @configTitle.
  ///
  /// In en, this message translates to:
  /// **'Configuration required'**
  String get configTitle;

  /// No description provided for @configIntro.
  ///
  /// In en, this message translates to:
  /// **'These public identifiers are compiled into the app at build time. No secret is ever stored in the APK.'**
  String get configIntro;

  /// No description provided for @configSet.
  ///
  /// In en, this message translates to:
  /// **'Set'**
  String get configSet;

  /// No description provided for @configMissing.
  ///
  /// In en, this message translates to:
  /// **'Missing'**
  String get configMissing;

  /// No description provided for @configPublic.
  ///
  /// In en, this message translates to:
  /// **'Public'**
  String get configPublic;

  /// No description provided for @configCopyCommand.
  ///
  /// In en, this message translates to:
  /// **'Copy build command'**
  String get configCopyCommand;

  /// No description provided for @configCopied.
  ///
  /// In en, this message translates to:
  /// **'Build command copied'**
  String get configCopied;

  /// No description provided for @configSecretsNote.
  ///
  /// In en, this message translates to:
  /// **'Client secrets, private keys and provider API keys live only on your broker and worker. They are never shipped in the application.'**
  String get configSecretsNote;

  /// No description provided for @backToWelcome.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get backToWelcome;

  /// No description provided for @signInNotYetAvailable.
  ///
  /// In en, this message translates to:
  /// **'Sign-in is not available in this build yet. The foundation, brand and configuration checks are in place.'**
  String get signInNotYetAvailable;

  /// No description provided for @capabilityMemory.
  ///
  /// In en, this message translates to:
  /// **'Curated memory that survives between sessions'**
  String get capabilityMemory;

  /// No description provided for @capabilityCheckpoints.
  ///
  /// In en, this message translates to:
  /// **'Encrypted checkpoints stored in your private repository'**
  String get capabilityCheckpoints;

  /// No description provided for @capabilityTools.
  ///
  /// In en, this message translates to:
  /// **'Hermes tools, skills and integrations under your approval'**
  String get capabilityTools;

  /// No description provided for @configWhereToGet.
  ///
  /// In en, this message translates to:
  /// **'GitHub App settings → About. Broker and worker URLs are yours to define.'**
  String get configWhereToGet;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en', 'fr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
    case 'fr':
      return AppLocalizationsFr();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
