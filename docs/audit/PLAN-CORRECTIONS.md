# Plan de corrections — étape par étape

Chaque étape se livre seule, dans un ou plusieurs commits, et se termine par la même vérification :

```
npm run typecheck && npm run lint && npm test && npm run build
```

À cela s'ajoutent, quand l'interface change, un passage manuel au clavier et avec NVDA sur le parcours complet
(accueil → CV → annonce → création → export).

Références entre crochets : constats de `AUDIT.md`.

## Avancement (14/10/2026)

Fait (tests unitaires + parcours vérifié dans l'application réelle, dossier de données temporaire) :
- Étape 1 : SEC-01 (protocole `app://`, IPC et navigation limités à l'interface), SEC-03 (analysé : risque accepté,
  voir l'audit), SEC-04 (`secure_delete`, `VACUUM`, journal vidé), SEC-06 (adresses du réseau local refusées, message
  dédié), SEC-07 (avertissement pour un Ollama distant, mentions de confidentialité ajustées).
- Étape 2 : ROB-01 (profil enregistré automatiquement), ROB-02 (choix des réglages enregistrés immédiatement, champs
  texte signalés), ROB-03 (base illisible mise de côté au démarrage), ROB-04 (fermeture bornée à 5 s).
- Étape 3 : A11Y-01, A11Y-02, A11Y-03, A11Y-06, A11Y-07, A11Y-09, A11Y-11 ; QUAL-06 au passage.
- Étape 4 : 4.1 (règle de langue), 4.3 (CI des pull requests, Dependabot), 4.4 (minification : 822 → 327 kB).

Reste dans ces étapes :
- 1.4 purge des données : attend D3.
- SEC-08 (sélecteur `.gguf`) : reporté ; sans effet tant que le process principal accepte le chemin envoyé par
  l'interface. Option « supprimer mes données » du désinstalleur : demande un script NSIS, reportée.
- 4.2 migrations versionnées : fait. Base : `PRAGMA user_version` + `src/main/bdd/migrations.ts` (migration 1 = schéma
  v0.2.1 ; base d'une version plus récente refusée sans être touchée). Réglages : champ `version` +
  `src/main/settingsMigrations.ts`. Vérifié sur un dossier de données v0.2.1 dans l'application.
- 1.4 purge : fait (profil actif + 20 dernières créations, après chaque import et chaque création).
- Étape 5 (renommage du core) : identifiants, fichiers et dossiers faits (commits `9f2dbb3`, `0ac5b5e`) ; données
  v0.2.1 converties (migration 2 de la base, migration 2 des réglages), vérifié dans l'application.
  Reste pour clore l'étape 5 :
  - 5.5 valeurs textuelles : codes d'erreur (`annule`, `fichier-illisible`…), identifiants des modèles de CV
    (`classique`… : migration des réglages), états (`en-cours`, `indisponible`…), étapes (`analyse`…), types de bloc,
    canaux IPC. À faire avec l'interface (étape 7) : elle compare certains codes sans contrôle de type.
  - Commentaires et noms de tests du core : traduits en anglais (fait). Les exemples français cités entre « » sont
    des données réelles (extraits de CV et d'annonces) et restent tels quels, comme le contenu des prompts.
- Étape 6 (process principal et preload) : fait. Identifiants, fichiers (`bdd/` → `db/`, `modeles/` → `models/`…),
  commentaires et noms de tests en anglais ; canaux IPC renommés ; migration 3 (tables et colonnes en anglais) ;
  dossier de données renommé au démarrage (`parametres.json` → `settings.json`, `cle-api.bin` → `api-key.bin`,
  `modeles/` → `models/`, chemin du modèle sélectionné mis à jour). Mise à jour depuis la v0.2.1 vérifiée dans
  l'application.
- Étape 7, partie renommage : fait. Identifiants, fichiers (`ecrans/` → `screens/`, `ui/Bouton` → `ui/Button`…),
  commentaires et noms de tests de l'interface en anglais. Valeurs textuelles (5.5) en anglais partout : codes
  d'erreur, états, étapes, icônes, variantes, vues, identifiants des modèles de CV (migration 3 des réglages).
  Exceptions voulues : balises des prompts (`<offre>`, `<titre>`…), classes CSS du CV exporté, données de test
  françaises.
- Étape 7, découpage et accessibilité : fait. ui/ un composant par fichier ; écrans découpés (MyCv 650 → 192,
  Settings 583 → 212, App 348 → 228, JobPosting, NewCv, TemplateGallery) ; A11Y-04, 05, 08, 10, 12, 13, 14, 15 ;
  QUAL-04, QUAL-05. Vérifié dans l'application : retrait annulable, dialogue d'effacement, aucun défilement
  horizontal à 320 et 640 px de large (zoom 400 % et 200 %). Reste à faire par une personne : un passage complet
  au lecteur d'écran (NVDA) et en mode Contraste élevé de Windows.
- Étape 8, performance :
  - PERF-01 fait : pendant la saisie, seul l'aperçu choisi est recalculé (vérifié : 2 cadres rafraîchis à ~260 ms,
    les 5 autres vignettes à ~1,4 s ; changer de modèle ne relance aucun rendu).
  - PERF-02 fait : grammaire en cache par schéma, contexte et séquence réutilisés, libérés après 30 s d'inactivité.
    Mesure (Qwen3.5 9B sur GPU, `npm run try`) : adaptation 9,2-9,5 s → 8,1-8,8 s ; gain plus fort en mode
    « réécriture » et sur processeur.
  - PERF-03 fait : détection RAM/VRAM une fois par session.
  - PERF-04 reporté : extraction mesurée à 20-120 ms pour un PDF de 90 à 350 ko ; un fil séparé ajouterait une
    entrée de build et des risques d'empaquetage (pdf.js) pour un gain imperceptible.
  - PERF-06 non corrigé : les `.woff` et le sous-ensemble vietnamien (~52 ko) ne sont jamais chargés par Chromium ;
    seul l'installeur en porte le poids.
  - PERF-07 : binaires ARM exclus. Installeur mesuré à 396 Mo (1 121 Mo installés). Sans les binaires CUDA :
    177 Mo (603 Mo installés) ; les cartes NVIDIA passeraient alors par Vulkan. Décision D5 ci-dessous.
  - Scripts passés en anglais : `npm run try` (`scripts/try-pipeline.ts`), `latest-yml.mjs`, fixtures renommées.
- Étape 9, textes hors du code : fait.
  - Point 1 : tous les textes de l'interface sont dans `src/renderer/src/i18n/fr.ts`, lus par `texts.…` (objet
    typé : une clé fausse ne compile pas ; aucune dépendance, pas de fonction `t('clé')`). Vérifié par les 23
    scénarios de bout en bout, qui cliquent sur les libellés réels.
  - Point 2 : les libellés de progression envoyés par le main n'étaient jamais affichés (l'interface part de la clé
    d'étape) : supprimés. Messages techniques passés en anglais. Les messages d'erreur lisibles par l'utilisateur
    (volet « Détails ») restent en français dans le main et le core.
  - Point 3 : libellés du CV produit dans `CV_LABELS[langue]` ; sections identifiées par un `id`.
  - Restent hors du dictionnaire, à traiter avec une deuxième langue : noms et descriptions des mises en page
    (`core/export/templates.ts`) et des modèles locaux (`core/llm/localModels.ts`), messages d'erreur du main.
- Étape 10, contributions : `README.md` (anglais) et `README.fr.md`, `CONTRIBUTING.md`, `SECURITY.md` (signalement
  privé par GitHub), `CODE_OF_CONDUCT.md` (adresse de contact à renseigner), formulaires de tickets et modèle de pull
  request. Le journal de diagnostic (AMEL-03) attend une décision (D6) : les messages d'erreur des bibliothèques LLM
  peuvent contenir des extraits du CV, il faut choisir ce qui est journalisé.
- Effet de bord connu de SEC-01 : le `localStorage` change d'origine (`file://` → `app://recv`) ; à la mise à jour,
  le nom du fichier CV affiché et la durée estimée repartent de zéro (aucune donnée du CV n'est perdue).

## Décisions à prendre avant de commencer

| # | Question | Recommandation | Bloque |
|---|---|---|---|
| D1 | Valider le glossaire (`GLOSSAIRE.md`) | relire surtout §1 et §2 (champs persistés) | étapes 5 à 7 |
| D2 | Dépendances de test : `@testing-library/react`, `happy-dom`, `vitest-axe` (dev uniquement) | oui | étape 7 (tests de composants) |
| D3 | Données conservées : historique « Mes CV » ou purge [SEC-05, AMEL-04] | purge maintenant (dernier profil, 20 dernières créations), historique plus tard | étape 1.4 |
| D4 | Langue des prompts [I18N-02] | français, sortis dans `prompts/fr.ts` | étape 5 |
| D5 | Binaires CUDA dans l'installeur [PERF-07] | à décider : 396 Mo avec, 177 Mo sans (NVIDIA via Vulkan) | — |
| D6 | Journal de diagnostic [AMEL-03] | à décider : contenu (codes d'erreur seuls, ou messages filtrés) | — |

---

## Étape 1 — Sécurité (petits correctifs, risque faible)

1. **Navigation et IPC verrouillés** [SEC-01] : protocole `app://` (`protocol.handle`), `will-navigate` toujours
   bloqué, expéditeur IPC comparé à l'URL exacte de l'interface. Fichiers : `src/main/index.ts`,
   `src/main/durcissement.test.ts`. Risque : chargement des polices et images à vérifier dans l'application installée
   (`npm run build:win` puis lancement de l'installeur).
2. **Dépendances** [SEC-03] : vérifier que `simple-git` et `argparse` ne sont pas chargés à l'exécution ; `overrides`
   vers les versions corrigées ; `npm audit --omit=dev` doit ne plus rien signaler de critique.
3. **Effacement réel** [SEC-04] : `secure_delete`, `wal_checkpoint(TRUNCATE)`, `VACUUM` ; test qui relit le fichier
   brut et n'y trouve plus le nom du profil. Option du désinstalleur pour supprimer les données.
4. **Conservation minimale** [SEC-05] (selon D3) : purge des anciens profils et des créations au-delà de la limite.
5. **Réseau local et Ollama** [SEC-06, SEC-07] : hôtes privés refusés pour les offres ; Ollama distant en `http`
   refusé ou signalé.
6. **Modèle `.gguf` personnalisé** [SEC-08] : sélecteur de fichier natif à la place du champ libre.

## Étape 2 — Pertes de données et robustesse

1. **Brouillon du profil conservé** [ROB-01] : enregistrement automatique (pause de 800 ms) ou brouillon remonté dans
   `App` ; test qui modifie un champ, change de vue, revient.
2. **Réglages** [ROB-02] : radios et cases enregistrés immédiatement ; avertissement si un champ avancé est modifié
   sans être enregistré.
3. **Démarrage robuste** [ROB-03] : base illisible sauvegardée puis recréée, message clair sinon.
4. **Fermeture bornée** [ROB-04] : délai maximal de libération du modèle.

## Étape 3 — Accessibilité : les correctifs à fort impact

À faire avant le renommage : petits changements, bénéfice immédiat pour les utilisateurs.

1. **Focus et titre à chaque changement d'écran** [A11Y-01, A11Y-02] : `h1` focalisé et `document.title` mis à jour
   dans `App.tsx`.
2. **Régions live calmes** [A11Y-03] : annonces par paliers dans `Preparation.tsx` et `Reglages.tsx`.
3. **Contraste du texte indicatif** [A11Y-07] : `Champ.tsx`.
4. **`autocomplete` et types de champs** [A11Y-06] : `Champ.tsx`, `MonCv.tsx`.
5. **`Alerte`** [A11Y-09] : niveau de titre en prop, une seule annonce, focus visible.
6. **PDF balisé** [A11Y-11] : `generateTaggedPDF`, `generateDocumentOutline` ; contrôle avec PAC.

## Étape 4 — Fondations du renommage

1. **`CLAUDE.md`** : règle de langue (déjà faite le 14/10/2026), frontière du core précisée [ARCH-08].
2. **Migrations versionnées** [QUAL-02] : registre `src/main/bdd/migrations/` piloté par `PRAGMA user_version`
   (migration 1 = schéma actuel) ; `parametres.json` versionné ; tests qui partent d'une base et de réglages de la
   v0.2.1 (fixtures à créer à partir de l'application actuelle).
3. **CI sur les pull requests** [AMEL-01] : nouveau workflow `ci.yml` (lint, typecheck, tests, build,
   `permissions: contents: read`), Dependabot. Filet indispensable pour les étapes suivantes.
4. **Minification** [PERF-05] : une ligne dans `electron.vite.config.ts`, à faire avant que le bundle ne bouge.

## Étape 5 — Renommage : `src/core`

Ordre interne, un commit par sous-dossier, tests au vert entre chaque :

1. `schemas/` + **migration 2** (renomme les clés JSON des colonnes de données, les tables et les colonnes ;
   transforme `parametres.json` en `settings.json`) ; test de migration aller sur la fixture v0.2.1.
2. `llm/` (prompts sortis dans `prompts/fr.ts` selon D4, noms de champs cités mis à jour).
3. `job-posting/` (ex-`offre/`), `tailoring/` (ex-`adaptation/`), `export/`, `parsing/`.
4. `api.ts`, `channels.ts`, `errors.ts`, `steps.ts` ; unification des fonctions de normalisation de texte et de la
   mention « H/F » [ARCH-06].

Risque principal : la qualité des sorties du LLM change avec les noms de champs JSON. Vérification supplémentaire :
`npm run essai` sur les fixtures avec le modèle local et Ollama, CV produits comparés avant / après.

## Étape 6 — Renommage : `src/main` et `src/preload`

1. `db/`, `models/`, `job-posting/`, `settingsStore.ts`, `updater.ts`, `readCv.ts` ; dossier `userData/modeles` →
   `models` (déplacement des fichiers à la première ouverture).
2. Canaux IPC et méthodes de l'API ; `broadcast()` commun [ARCH-06].
3. Découpage de `service.ts` [ARCH-07].
4. Mise à jour depuis la v0.2.1 testée **avec l'installeur** : profil, réglages, clé API et modèle téléchargé doivent
   être retrouvés.

## Étape 7 — Interface : renommage, découpage et accessibilité, écran par écran

Chaque écran est renommé, découpé et corrigé dans le même lot, pour ne le toucher qu'une fois. Tests de composants et
`axe` ajoutés au fil de l'eau (selon D2).

1. `ui/` : un composant par fichier [ARCH-04] ; `ConfirmDialog` [A11Y-04] ; onglets Home/End [A11Y-13] ;
   choix de la mise en page en `radiogroup` [A11Y-14] ; barres de progression indéterminées [A11Y-15] ; règles
   `forced-colors` [A11Y-10].
2. `App.tsx` : `AppHeader`, `useEngineStatus`, `useTailoringFlow`, état du parcours en `useReducer` [ARCH-03] ;
   suppression de l'appel inutile [QUAL-05].
3. `MyCv` [ARCH-01] avec suppression annulable et focus maîtrisé [A11Y-05], textes non tronqués [A11Y-12].
4. `Settings` [ARCH-02] avec groupe de radios légendé [A11Y-08] ; catalogue des niveaux dans le core [QUAL-04].
5. `JobPosting`, `NewCv`, `TemplateGallery`, `WhatChanged` [ARCH-05] ; pastille d'accueil corrigée [QUAL-06].
6. Contrôle final : parcours complet au clavier, NVDA, zoom 200 %, Contraste élevé de Windows, fenêtre de
   900 × 640.

## Étape 8 — Performance

Mesurer avant et après chaque point.

1. Aperçus [PERF-01] : modèle affiché seulement pendant la saisie, ou rendu dans le renderer.
2. Moteur local [PERF-02, PERF-03] : grammaire en cache, contexte réutilisé, détection mémoire mise en cache. Mesure :
   durée totale d'une adaptation avec `npm run essai -- --fournisseur local`.
3. Lecture du CV hors du fil principal [PERF-04].
4. Polices [PERF-06] et taille de l'installeur [PERF-07].

## Étape 9 — Textes de l'interface hors du code [I18N-01]

1. Dictionnaire `src/renderer/src/i18n/fr.ts` typé et `t()` sans dépendance.
2. Messages du main et du core remplacés par des codes traduits dans l'interface.
3. Titres de sections du CV indexés par langue (prépare AMEL-05).

## Étape 10 — Ouverture aux contributions [AMEL-02, AMEL-03]

`README.md` en anglais (+ `README.fr.md`), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, modèles d'issues et
de PR ; journal local de diagnostic.

---

## Récapitulatif

| Étape | Contenu | Taille | Pour l'utilisateur final |
|---|---|---|---|
| 1 | Sécurité | M | données mieux protégées |
| 2 | Robustesse | S | plus de corrections perdues |
| 3 | Accessibilité prioritaire | S | utilisable au lecteur d'écran |
| 4 | Fondations (migrations, CI) | M | — |
| 5–6 | Renommage core, main, preload | L | — (mise à jour transparente) |
| 7 | Interface : découpage + accessibilité | L | interface plus fiable et accessible |
| 8 | Performance | M | création et aperçus plus rapides |
| 9 | Textes hors du code | L | — (prépare l'anglais) |
| 10 | Documentation contributeurs | S | — |
