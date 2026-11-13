// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appName => 'AETHER AI';

  @override
  String get tagline => 'Votre agent IA personnel autonome';

  @override
  String get splashLoading => 'Préparation de votre espace';

  @override
  String get welcomeHeadline => 'Un agent personnel qui se souvient';

  @override
  String get welcomeBody =>
      'AETHER relie votre appareil Android à un agent Hermes qui planifie des tâches, utilise des compétences, conserve une mémoire organisée et restaure son état lors d\'une reprise.';

  @override
  String get continueWithGithub => 'Continuer avec GitHub';

  @override
  String get signInLocked =>
      'La connexion GitHub est bloquée jusqu\'à ce que l\'application soit configurée avec votre Client ID GitHub App.';

  @override
  String get viewSetupRequirements => 'Voir les prérequis de configuration';

  @override
  String get configTitle => 'Configuration requise';

  @override
  String get configIntro =>
      'Ces identifiants publics sont intégrés à l\'application lors de la compilation. Aucun secret n\'est stocké dans l\'APK.';

  @override
  String get configSet => 'Défini';

  @override
  String get configMissing => 'Manquant';

  @override
  String get configPublic => 'Public';

  @override
  String get configCopyCommand => 'Copier la commande de build';

  @override
  String get configCopied => 'Commande copiée';

  @override
  String get configSecretsNote =>
      'Les secrets client, les clés privées et les clés des fournisseurs restent sur votre broker et votre worker. Ils ne sont jamais embarqués dans l\'application.';

  @override
  String get backToWelcome => 'Retour';

  @override
  String get signInNotYetAvailable =>
      'La connexion n\'est pas encore disponible dans cette version. La base, l\'identité et les contrôles de configuration sont en place.';

  @override
  String get capabilityMemory =>
      'Une mémoire organisée qui persiste entre les sessions';

  @override
  String get capabilityCheckpoints =>
      'Des points de reprise chiffrés dans votre dépôt privé';

  @override
  String get capabilityTools =>
      'Outils, compétences et intégrations Hermes sous votre approbation';

  @override
  String get configWhereToGet =>
      'Paramètres de la GitHub App → About. Les URLs du broker et du worker vous appartiennent.';
}
