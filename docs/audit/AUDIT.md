# Audit de Re:CV — 14 octobre 2026 (v0.2.1, commit `b1be873`)

Périmètre : `src/core`, `src/main`, `src/preload`, `src/renderer`, `scripts/`, configuration de build et CI.
Méthode : lecture de chaque fichier source, mesures de base, calcul des contrastes à partir des jetons de couleur
réels (`src/renderer/src/index.css`). Les points marqués **à vérifier** demandent un essai à l'exécution.

## Résumé

L'application part d'une base saine : Electron correctement isolé (`contextIsolation`, `sandbox`, fuses), entrées IPC
revalidées par Zod, clé API chiffrée et liée à son origine, modèles téléchargés vérifiés par SHA-256, garde-fous
anti-invention écrits en code (pas seulement dans les prompts), CSP stricte, sémantique HTML soignée. Les problèmes
sont surtout ailleurs :

| # | Constat | Gravité |
|---|---|---|
| ROB-01 | Les corrections du profil sont perdues si l'on quitte l'étape ① autrement que par « Ça me va, continuer » | Haute |
| A11Y-01 | Changement d'écran ni annoncé ni accompagné d'un déplacement du focus : un utilisateur de lecteur d'écran est perdu | Haute |
| A11Y-02 | Titre de fenêtre identique sur tous les écrans | Haute |
| A11Y-03 | Zones `role="status"` mises à jour toutes les 200 ms pendant les téléchargements : NVDA parle sans arrêt | Haute |
| QUAL-01 | Tout le code est en français : bloque les contributions extérieures (décision : migration vers l'anglais) | Haute |
| QUAL-02 | Ni migrations versionnées (SQLite), ni version des données JSON : aucun renommage possible sans perdre les profils des utilisateurs | Haute |
| SEC-01 | La fenêtre principale accepte la navigation vers n'importe quel `file://`, et l'IPC répond à toute page `file://` | Moyenne |
| SEC-03 | `npm audit` : 2 critiques, 1 haute, 3 modérées (via `node-llama-cpp` → `simple-git`, `mammoth` → `argparse`) | Moyenne |
| SEC-04 | « Tout effacer » laisse les données lisibles dans le fichier SQLite et le journal WAL | Moyenne |
| PERF-01 | Chaque modification à l'étape ③ régénère 6 aperçus HTML via IPC (photo comprise) et recharge 6 iframes | Moyenne |

État des vérifications automatiques (lancées le 14/10/2026) : `typecheck` OK, `lint` OK (136 fichiers),
`test` OK (28 fichiers, 254 tests), `build` OK. Bundle renderer : **822 kB non minifié**.

---

## 1. Sécurité

### [SEC-01] Moyenne — Navigation et expéditeur IPC acceptent tout `file://`
- Où : `src/main/index.ts:21-24`, `src/main/index.ts:49-51`
- Constat : en application installée, `expediteurAutorise` vaut `url.startsWith('file://')`. Il sert à la fois de
  filtre de navigation (`will-navigate`) et de contrôle de l'expéditeur IPC.
- Scénario : un lien `file:///C:/Users/…/page.html` (contenu injecté, glisser-déposer d'un fichier HTML sur la
  fenêtre) charge une page locale arbitraire dans la fenêtre principale ; le preload y est injecté et l'IPC lui répond
  (`importerCvDepose`, `exporterCv`, `effacerDonnees`…).
- Correction : servir l'interface par un protocole dédié (`protocol.handle('app', …)` + `registerSchemesAsPrivileged`),
  comparer l'URL exacte de `index.html`, et **refuser toute navigation** (l'interface est une SPA, elle ne navigue
  jamais). Bloquer aussi `will-attach-webview` et le dépôt de fichiers hors de `ZoneDepot`.
- Effort : M

### [SEC-02] OK — Chemin du CV déposé
`importerCvDepose` reçoit un chemin, mais le preload le calcule via `webUtils.getPathForFile` à partir d'un vrai
`File` : le renderer ne peut pas fournir un chemin arbitraire. Extension et taille sont revérifiées
(`src/main/lectureCv.ts`). Rien à corriger.

### [SEC-03] Moyenne — Dépendances vulnérables
- Où : `package.json` (dépendances `node-llama-cpp`, `mammoth`)
- Constat : `simple-git` (critique, exécution de commande via configuration Git) tiré par `node-llama-cpp` ;
  `sprintf-js` (déni de service) via `argparse` ← `mammoth`. `npm audit fix --force` propose des rétrogradations
  cassantes.
- Vérifié le 14/10/2026 en traçant les résolutions de modules (import de `node-llama-cpp`, `getLlama()`, conversion
  `mammoth`) : `argparse` et `sprintf-js` ne sont jamais chargés ; `simple-git` est chargé à l'import de
  `node-llama-cpp` mais n'est appelé que par sa commande `source download`, que Re:CV n'utilise pas. Les failles
  supposent d'exécuter `git` avec des options ou une configuration contrôlées par un attaquant : aucun chemin de Re:CV
  n'y mène.
- Pas de correctif disponible : `node-llama-cpp@3.22.1` (dernière) exige `simple-git@^3`, corrigé seulement en 4.0.2 ;
  `sprintf-js` n'a pas de version corrigée.
- Décision : risque accepté et suivi. Pas d'`overrides` vers `simple-git@4` (majeure non testée par `node-llama-cpp`).
  Revoir à chaque version de `node-llama-cpp` ; `npm audit --omit=dev` non bloquant dans la CI (étape 4).
- Effort : S

### [SEC-04] Moyenne — L'effacement des données n'est pas physique
- Où : `src/main/bdd/depots.ts:20-24`, `src/main/bdd/connexion.ts:31-34`
- Constat : `DELETE` seul, en mode WAL, sans `secure_delete` ni `VACUUM`. Les pages libérées et le fichier `-wal`
  gardent le texte du CV. Le désinstalleur conserve aussi `userData` (`electron-builder.yml:34`).
- Scénario : l'utilisateur clique « Tout effacer » sur un ordinateur partagé ; le CV reste lisible avec un éditeur
  SQLite ou un éditeur hexadécimal.
- Correction : `PRAGMA secure_delete = ON` à l'ouverture, puis après effacement `wal_checkpoint(TRUNCATE)` et
  `VACUUM`. Proposer la suppression des données dans le désinstalleur (case à cocher NSIS).
- Effort : S

### [SEC-05] Moyenne — Données personnelles accumulées sans limite
- Où : `src/main/service.ts:137` (`creerProfil` à chaque import), `src/main/service.ts:217-218`
- Constat : chaque import crée un nouveau profil et chaque création enregistre l'offre et le CV adapté ; seul le
  dernier profil est jamais relu. Rien n'est purgé.
- Correction : décider (voir AMEL-04) entre un historique visible (« Mes CV ») ou une conservation minimale (dernier
  profil, N dernières créations).
- Effort : S (purge) / L (historique)

### [SEC-06] Basse — Récupération d'offre vers le réseau local
- Où : `src/core/offre/recuperation.ts:45-53`, `src/main/offre/rendu.ts:33-38`
- Constat : seules les URL `http(s)` sont filtrées. `http://192.168.1.1/…` ou `http://localhost:…` sont récupérées, et
  la fenêtre de repli y exécute le JavaScript de la page.
- Correction : refuser les hôtes de bouclage, privés et link-local (après résolution DNS) pour la récupération
  d'offres.
- Effort : S

### [SEC-07] Basse — Ollama accepte `http` vers n'importe quel hôte
- Où : `src/core/api.ts:47`
- Constat : l'URL de l'API distante exige `https` hors `localhost`, pas celle d'Ollama. Un Ollama sur une autre machine
  reçoit le CV en clair, et l'écran affiche « Les données restent chez vous » (`src/renderer/src/ecrans/Reglages.tsx:400`).
- Correction : même règle que l'API, ou avertissement explicite dès que l'hôte n'est pas local.
- Effort : S

### [SEC-08] Basse — Modèle local : chemin libre vers un fichier `.gguf`
- Où : `src/renderer/src/ecrans/Reglages.tsx:483-487`, `src/core/api.ts:54-58`
- Constat : n'importe quel `.gguf` est chargé par du code natif (le parseur GGUF de llama.cpp a déjà eu des failles).
- Correction : sélection par le sélecteur de fichier natif, avertissement « fichier de source inconnue ».
- Effort : S

### [SEC-09] Info — Workflow de release
- Où : `.github/workflows/release.yml:8-9`
- Constat : actions épinglées par SHA, `persist-credentials: false` : bien. `contents: write` est global (un seul job :
  acceptable). Il manque une CI sur les pull requests (voir AMEL-01), indispensable avant d'accepter des contributions.

### [SEC-10] OK — Injection de prompt
Contenus encadrés (`encadrer`), termes de l'offre assainis avant réinjection (`assainirLigne`), contrôles en code des
sorties (termes interdits, nombres, durées, vocabulaire). Rien à corriger ; garder les tests `garde.test.ts` et
`coherence.test.ts` à jour lors du renommage.

---

## 2. Accessibilité (WCAG 2.2 AA)

Points déjà bons : `lang="fr"`, libellés reliés aux champs, erreurs reliées (`aria-describedby`, `aria-invalid`),
focus visible (contour 3 px), `prefers-reduced-motion` respecté, `<details>` natifs, annonce des étapes de création
en zone `sr-only`, icônes décoratives masquées. Contrastes mesurés : texte d'aide 7,25:1, blanc sur vert 7,20:1,
erreur 6,26:1, alerte 6,61:1, info 7,52:1.

### [A11Y-01] Haute — Changements d'écran silencieux (2.4.3, 4.1.3)
- Où : `src/renderer/src/App.tsx:80-88`
- Constat : `aller()` change la vue et remonte la page, sans déplacer le focus. Le bouton cliqué disparaît : le focus
  tombe sur `<body>`.
- Scénario : avec NVDA, « Ça me va, continuer » ne produit aucune annonce ; Tab repart du haut de la page.
- Correction : après chaque changement de vue, focus sur le `<h1>` de l'écran (`tabIndex={-1}`), via un composant
  `PageTitle` commun.
- Effort : S

### [A11Y-02] Haute — Titre de fenêtre unique (2.4.2)
- Où : `src/renderer/index.html:9`
- Correction : `document.title` par vue (« Étape 2 sur 3 : l'annonce — Re:CV »).
- Effort : S

### [A11Y-03] Haute — Régions live bavardes (4.1.3)
- Où : `src/renderer/src/ecrans/Reglages.tsx:234-238`, `src/renderer/src/ecrans/Preparation.tsx:110-116`
- Constat : le texte « X Go sur Y Go · reste N min » est dans un `role="status"` et change à chaque progression émise
  (toutes les 200 ms, `src/main/modeles/gestionnaire.ts:17`).
- Scénario : pendant les plusieurs minutes de téléchargement, le lecteur d'écran lit en continu.
- Correction : texte visible hors région live ; région `sr-only` annoncée par paliers (tous les 10 %, puis
  « vérification », puis « terminé »).
- Effort : S

### [A11Y-04] Moyenne — Confirmation d'effacement sans gestion du focus (2.4.3)
- Où : `src/renderer/src/ecrans/Reglages.tsx:498-525`
- Constat : le `role="alertdialog"` apparaît sans recevoir le focus ; « Non, garder mes données » ne rend pas le
  focus au bouton d'origine ; Échap ne ferme pas.
- Correction : composant `ConfirmDialog` réutilisable (focus initial, Échap, retour du focus), ou `<dialog>` natif.
- Effort : S

### [A11Y-05] Moyenne — Suppression d'éléments du profil
- Où : `src/renderer/src/ecrans/MonCv.tsx:377-383`, `:450-456`, `:492-494`
- Constat : après « Retirer », le focus est perdu ; les boutons « Retirer » des langues ont tous le même nom
  (2.4.6) ; aucune annulation possible, alors que le public visé craint de « casser » quelque chose.
- Correction : `aria-label` contextuel (« Retirer l'anglais »), focus déplacé sur l'élément suivant ou sur
  « Ajouter », message « Expérience retirée — Annuler ».
- Effort : M

### [A11Y-06] Moyenne — Champs d'identité sans `autocomplete` (1.3.5)
- Où : `src/renderer/src/ecrans/MonCv.tsx:282-300`, `src/renderer/src/ui/Champ.tsx:24-88`
- Correction : `Champ` accepte `autoComplete`, `inputMode` et les types `email` / `tel` ; renseigner `name`, `email`,
  `tel`, `address-level2`, `url`.
- Effort : S

### [A11Y-07] Moyenne — Contraste du texte indicatif (1.4.3)
- Où : `src/renderer/src/ui/Champ.tsx:5` (`placeholder:text-trait-fort`)
- Constat : 3,59:1 sur blanc, sous le seuil de 4,5:1. Les placeholders portent des exemples utiles
  (« Ex. : 2019 – 2024 »).
- Correction : couleur `aide` (≥ 7:1) ou déplacer l'exemple dans l'aide sous le champ.
- Effort : S

### [A11Y-08] Moyenne — Groupe de boutons radio « moteur » sans légende (1.3.1)
- Où : `src/renderer/src/ecrans/Reglages.tsx:35-73`, `:369-472`
- Constat : les trois radios `name="moteur"` sont réparties entre la carte et le bloc « Options avancées », sans
  `fieldset`/`legend` ni `radiogroup` nommé.
- Correction : `fieldset` + `legend` « Où tourne le moteur » ; si le bloc avancé reste replié, annoncer que deux
  autres choix s'y trouvent.
- Effort : S

### [A11Y-09] Moyenne — `Alerte` : niveau de titre fixe, double annonce
- Où : `src/renderer/src/ui/Alerte.tsx:35-37`, `:56`
- Constat : le titre est toujours un `h3` (saut h1 → h3 sur l'écran ① vide) ; `role="alert"` et déplacement du focus
  se cumulent (annonce en double) ; le titre focalisé n'a pas de contour (`outline-none`).
- Correction : prop `headingLevel`, choisir entre `role="alert"` et focus, garder un indicateur visible.
- Effort : S

### [A11Y-10] Moyenne — Mode Contraste élevé de Windows (1.4.11) — à vérifier
- Où : `src/renderer/src/ui/structure.tsx:253-282` (vignettes), `Reglages.tsx:53-58` (cartes de choix),
  `ui/Etapes.tsx:44-50` (pastille d'étape), barres de progression
- Constat : l'état choisi et la progression reposent sur des fonds et des bordures colorés, que `forced-colors`
  remplace ou supprime.
- Correction : tester sous « Contraste élevé » ; ajouter des règles `@media (forced-colors: active)` (bordures
  `Highlight`, barres en `CanvasText`).
- Effort : M

### [A11Y-11] Moyenne — PDF exporté non balisé
- Où : `src/main/export.ts:17`
- Constat : `printToPDF` est appelé sans `generateTaggedPDF` ni `generateDocumentOutline`. Le PDF n'a ni structure
  pour les lecteurs d'écran ni plan, et certains ATS lisent mieux un PDF balisé.
- Correction : activer les deux options (présentes dans les versions récentes d'Electron, **à vérifier** pour la
  v44), vérifier le résultat avec PAC ou l'inspecteur d'Acrobat.
  Pour le DOCX, définir la langue du document (**à vérifier** dans l'API de `docx`).
- Effort : S

### [A11Y-12] Basse — Textes tronqués (1.4.4, 1.4.10)
- Où : `MonCv.tsx:234-235` (nom, métier), `ui/Etapes.tsx:55-63`, `Succes.tsx:47` (nom de fichier)
- Constat : `truncate` coupe des informations utiles à 200 % de zoom ou avec le texte agrandi de Windows.
- Correction : retour à la ligne (`break-words`) au lieu de troncature ; stepper compact (numéro + nom) sous 1100 px.
- Effort : S

### [A11Y-13] Basse — Onglets segmentés
- Où : `src/renderer/src/ui/structure.tsx:152-205`
- Constat : pas de Début/Fin ; pendant un chargement les onglets sont `disabled`, le focus est perdu.
- Correction : gérer Home/End ; `aria-disabled` plutôt que `disabled`.
- Effort : S

### [A11Y-14] Basse — Choix de la mise en page
- Où : `src/renderer/src/ui/structure.tsx:253-282`, `ecrans/GalerieModeles.tsx:89-107`
- Constat : choix unique exposé comme six boutons à bascule (`aria-pressed`), avec « (choisi) » en double.
- Correction : `radiogroup` (radios natives masquées visuellement) avec flèches.
- Effort : S

### [A11Y-15] Basse — Barres de progression indéterminées
- Où : `Reglages.tsx:217-223`, `Preparation.tsx:118-124`
- Constat : `aria-valuenow` reste exposé pendant la vérification (indéterminée).
- Correction : omettre `aria-valuenow` dans ce cas.
- Effort : S

---

## 3. Découpage en composants et architecture

### [ARCH-01] Moyenne — `ecrans/MonCv.tsx` (582 lignes)
Découpage proposé (noms du glossaire) :
`screens/MyCv/` → `MyCvScreen` (aiguillage), `CvImportStep` (zone de dépôt + chargement), `ProfileSummaryCard`
(bandeau sombre), `ContactSection`, `ExperienceList` + `ExperienceFieldset`, `SkillsSection`, `EducationList` +
`EducationFieldset`, `LanguageList` + `LanguageRow`, `PhotoSection` ; hooks `useCvImport`, `useProfileDraft` ;
utilitaires `cleanProfile`, `CEFR_LEVELS` dans `profile/`. Effort : M

### [ARCH-02] Moyenne — `ecrans/Reglages.tsx` (536 lignes)
`EngineChoiceCard` (ex-`ChoixMoteur`), `ModelLevels` + `ModelLevelRow` (ex-`NiveauxModele`), `AdvancedOptions`,
`OnlineServiceForm`, `EraseDataCard` + `ConfirmDialog` générique ; hooks `useSettings`, `useModelDownloads`.
Effort : M

### [ARCH-03] Moyenne — `App.tsx` (330 lignes)
Mélange machine d'états du parcours, appels IPC, en-tête et aiguillage. Extraire `AppHeader`, `useEngineStatus`
(`verifierMoteur`), `useTailoringFlow` (création, autre offre, effacement) et un `ViewRouter`. Passer l'état du
parcours (vue, annonce, résultat, export, erreur) dans un `useReducer` testable, à côté de `parcours.ts`. Effort : M

### [ARCH-04] Basse — `ui/structure.tsx` regroupe 9 composants
Un composant par fichier : `Card`, `PageTitle`, `Loading`, `Pill`, `Collapsible`, `SegmentedTabs`, `EmptyState`,
`ActionBar`, `TemplateThumbnail`. Effort : S

### [ARCH-05] Basse — `ecrans/Annonce.tsx`, `NouveauCv.tsx`, `GalerieModeles.tsx`
- Annonce : `JobPostingForm` (saisie), `JobPostingConfirmation` (carte), `RequirementsNote`, `JobPostingTextEditor` ;
  hook `useJobPostingReader`.
- Nouveau CV : `TitleSummarySection`, `HighlightedSkillsSection`, `ExcludedItemsSection` ; hooks
  `useTailoredCvDraft` (état + `cvFinal`) et `useCvExport`.
- Galerie : `useApercus` vers `hooks/` ; la mise à l'échelle par `ResizeObserver` est dupliquée
  (`GalerieModeles.tsx:50-58` et `:130-138`) → `useScaleToWidth`.
- Effort : M

### [ARCH-06] Basse — Fonctions dupliquées
- `remplacer` : `MonCv.tsx:58`, `NouveauCv.tsx:12`, `CeQuiAChange.tsx:7` ; `lignes` : `MonCv.tsx:22`,
  `CeQuiAChange.tsx:6` ; `joindre` : `MonCv.tsx:62`, `core/export/modele.ts:37`.
- Normalisation de texte : `normaliser` (`core/adaptation/texte.ts:5`), `simplifier` (`core/llm/assainissement.ts:10`),
  `cle` (`core/export/modele.ts:36`).
- Mention « H/F » : `titreSansMention` (`renderer/src/parcours.ts:122`) et `MARQUES_GENRE`
  (`core/offre/texte.ts:160`), deux expressions différentes pour le même besoin.
- Diffusion « à toutes les fenêtres » répétée trois fois dans `src/main/index.ts:82`, `:97`, `:108`.
- Correction : `core/text/` (normalisation unique), `renderer/src/lib/lists.ts`, `broadcast(channel, payload)` côté
  main. Effort : S

### [ARCH-07] Basse — `src/main/service.ts` fait tout
Cycle de vie du fournisseur LLM, cache d'analyse, export, ouverture de fichiers. Extraire `providerManager`,
`jobAnalysisCache`, `exportService`. Effort : M

### [ARCH-08] Info — Frontière de `src/core`
`core` n'importe pas Electron, mais utilise Node (`Buffer`), `linkedom` et `react-dom/server` (`CvHtml.tsx`). C'est
cohérent avec son usage (process principal, CLI, tests) ; préciser dans `CLAUDE.md` : « core : sans Electron, Node
autorisé, jamais de DOM du navigateur ».

---

## 4. Bonnes pratiques et qualité

### [QUAL-01] Haute — Code en français
Identifiants, fichiers, dossiers, commentaires, tests, canaux IPC, tables et colonnes, clés JSON persistées : tout est
en français. Glossaire complet dans `GLOSSAIRE.md`, migration en plusieurs lots dans `PLAN-CORRECTIONS.md`.

### [QUAL-02] Haute — Aucune migration versionnée
- Où : `src/main/bdd/connexion.ts:8-27` (`CREATE TABLE IF NOT EXISTS`), `src/main/parametres.ts:31-37`
- Constat : pas de `PRAGMA user_version`, pas de version dans `parametres.json` ni dans le JSON des colonnes
  `donnees`. Les clés de ce JSON (`poste`, `entreprise`, `realisations`…) sont celles des schémas Zod : les renommer
  sans migration rend illisibles les profils déjà enregistrés. Un `parametres.json` invalide est remplacé en silence
  par les valeurs par défaut.
- Correction : registre de migrations (`user_version`), migration des fichiers de réglages et des clés
  `localStorage` (`recv.nomFichierCv`, `recv.dureeCreation`), tests de migration sur une base de la v0.2.1.
- Effort : M

### [QUAL-03] Moyenne — Tests du renderer quasi absents
- Constat : un seul fichier (`parcours.test.ts`). Aucun test de composant, d'accessibilité ou de migration.
- Correction : `@testing-library/react` + `happy-dom` (ou `jsdom`) + `vitest-axe` — **trois nouvelles dépendances de
  développement, à valider**. Commencer par `Champ`, `Etapes`, `SegmentedTabs`, `ConfirmDialog`, puis un parcours
  complet avec un `window.api` simulé.
- Effort : M

### [QUAL-04] Basse — Catalogue des modèles en partie dans l'interface
- Où : `Reglages.tsx:21-25` (`NIVEAUX` indexé par `qwen3.5-2b`…)
- Correction : un niveau (`fast` / `balanced` / `quality`) dans `core/llm/modelesEmbarques.ts`, le libellé dans les
  textes de l'interface.
- Effort : S

### [QUAL-05] Basse — Appel inutile avant l'affichage du résultat
- Où : `src/renderer/src/App.tsx:113-117`
- Constat : `htmlModeleCv` est appelé puis son résultat est jeté ; l'aperçu est recalculé par `useApercus`.
- Correction : supprimer l'appel, ou transmettre le HTML obtenu à l'écran ③.
- Effort : S

### [QUAL-06] Basse — Promesse contredite en mode en ligne
- Où : `src/renderer/src/ecrans/Accueil.tsx:25-27`
- Constat : la pastille « sur votre ordinateur » reste affichée quand un service en ligne est choisi.
- Effort : S

### [QUAL-07] Basse — Photo WebP acceptée mais perdue en DOCX
- Où : `src/core/schemas/profil.ts:32` (accepte `webp`), `src/core/export/docx.ts:63` (png/jpeg seulement)
- Constat : l'interface produit toujours du JPEG, mais le schéma laisse passer un WebP, ignoré sans message.
- Correction : limiter le schéma à PNG/JPEG.
- Effort : S

---

## 5. Performance

### [PERF-01] Moyenne — Aperçus recalculés en entier à chaque modification
- Où : `src/renderer/src/ecrans/GalerieModeles.tsx:23-40`
- Constat : 400 ms après chaque frappe, 6 appels IPC séquentiels (CV complet à l'aller, HTML avec photo en base64 au
  retour), puis 6 iframes rechargées, dont la grande.
- Mesure : profil « Performance » des DevTools pendant la saisie de l'accroche ; compter les appels `cv:html-modele`.
- Correction : ne recalculer que le modèle affiché pendant la saisie et les vignettes au repos (ou à la demande) ;
  ou produire le HTML dans le renderer (`CvHtml` est un composant React pur) et supprimer l'aller-retour IPC.
- Effort : M

### [PERF-02] Moyenne — Modèle local : contexte et grammaire recréés à chaque appel
- Où : `src/core/llm/moteurLocal.ts:134-163`
- Constat : chaque appel crée un contexte de 8 192 jetons (allocation du cache KV) et compile une grammaire JSON. Une
  adaptation en fait 3 à 6, plus une par expérience en mode « réécriture ».
- Mesure : chronométrer `createContext` et `createGrammarForJsonSchema` dans `npm run essai -- --fournisseur local`.
- Correction : grammaire mise en cache par schéma ; contexte réutilisé (séquence vidée entre les appels), libéré à la
  fin de l'adaptation.
- Effort : M

### [PERF-03] Moyenne — Détection de la mémoire graphique à chaque lecture de l'état des modèles
- Où : `src/main/modeles/ressources.ts:14-16`, `src/main/modeles/gestionnaire.ts:43`
- Constat : `getLlama()` (chargement du moteur natif) à chaque ouverture des Réglages, de la préparation et au
  démarrage (`App.tsx:58`). Peut créer une seconde instance à côté de celle du moteur local (**à vérifier**).
- Correction : résultat mis en cache pour la session.
- Effort : S

### [PERF-04] Moyenne — Lecture du CV dans le fil du process principal
- Où : `src/main/lectureCv.ts:30-31` (`unpdf`, `mammoth`)
- Constat : un PDF de plusieurs Mo bloque la boucle du process principal ; toute l'interface attend ses réponses IPC.
- Correction : extraction dans un `utilityProcess` (ou `worker_threads`).
- Effort : M

### [PERF-05] Basse — Bundle renderer non minifié (822 kB)
- Où : `electron.vite.config.ts:11-14`
- Constat : le fichier produit contient le code lisible de React (`var reactJsxRuntime_production`).
- Correction : `build: { minify: true }` pour le renderer (et le main). Gain attendu : environ deux tiers de la taille,
  analyse plus rapide au démarrage.
- Effort : S

### [PERF-06] Basse — Polices en double
- Où : `src/renderer/src/index.css:2-4`
- Constat : `.woff` et `.woff2` embarqués, plus le sous-ensemble vietnamien.
- Correction : importer seulement les sous-ensembles `latin` et `latin-ext` en `woff2`.
- Effort : S

### [PERF-07] Basse — Taille de l'installeur — à vérifier
- Où : `electron-builder.yml:16-19`
- Constat : `node-llama-cpp` et `@node-llama-cpp/**` sont décompressés en entier ; les binaires CUDA et Vulkan pèsent
  plusieurs centaines de Mo.
- Mesure : taille de `release/ReCV-Setup-*.exe` et de `resources/app.asar.unpacked`.
- Correction : n'embarquer que les variantes utiles (`win-x64`, `win-x64-vulkan` ; CUDA à évaluer).
- Effort : M

---

## 6. Robustesse

### [ROB-01] Haute — Perte des corrections du profil
- Où : `src/renderer/src/App.tsx:249-258`, `src/renderer/src/ecrans/MonCv.tsx:97`
- Constat : le brouillon vit dans `EcranMonCv`, démonté dès que la vue change. Seul « Ça me va, continuer » enregistre.
- Scénario : l'utilisateur corrige trois expériences, ouvre les Réglages ou clique l'étape ② : tout est perdu, sans
  avertissement.
- Correction : enregistrement automatique (après une courte pause) ou brouillon remonté dans l'état du parcours, avec
  confirmation en cas de sortie.
- Effort : S

### [ROB-02] Moyenne — Réglages non enregistrés perdus en silence
- Où : `src/renderer/src/ecrans/Reglages.tsx:306`, `:529-533`
- Constat : choisir un niveau de modèle ou un moteur ne prend effet qu'avec « Enregistrer les réglages », en bas de
  page ; « Revenir où j'en étais » abandonne les changements.
- Correction : enregistrer immédiatement les choix simples (radios, cases) ; garder un bouton seulement pour les
  champs texte avancés, avec avertissement s'ils sont modifiés.
- Effort : S

### [ROB-03] Moyenne — Démarrage sans filet
- Où : `src/main/index.ts:66-140`
- Constat : une base corrompue ou un dossier `userData` en lecture seule fait échouer `ouvrirBdd` dans `whenReady` :
  fenêtre absente, aucun message.
- Correction : `try/catch`, sauvegarde de la base fautive, recréation, `dialog.showErrorBox` sinon.
- Effort : S

### [ROB-04] Basse — Fermeture bloquée si la libération du modèle ne termine pas
- Où : `src/main/index.ts:128-133`
- Correction : délai maximal (ex. 5 s) avant `app.quit()`.
- Effort : S

---

## 7. Internationalisation

### [I18N-01] Moyenne — Textes affichés écrits dans le code
- Constat : environ 300 textes en dur dans les composants ; des messages destinés à l'utilisateur produits dans
  `src/main` et `src/core` (`service.ts:75-79`, `lectureCv.ts`, `recuperation.ts:18`, libellés d'étapes de
  `pipeline.ts`) ; titres de sections du CV (`core/export/modele.ts:27-33`) liés au code.
- Correction (sans dépendance) : `src/renderer/src/i18n/fr.ts` (dictionnaire typé) et une fonction `t()` ; le main
  et le core renvoient des **codes** (le mécanisme `ErreurCodee` existe déjà) que l'interface traduit ; titres de
  section du CV indexés par la langue du CV produit. Le français reste la langue par défaut.
- Effort : L

### [I18N-02] Décision — Langue des prompts
Recommandation : garder les prompts en français tant que les CV produits sont en français (un prompt français donne
une sortie française plus naturelle avec les petits modèles locaux), mais les traiter comme du **contenu** : les sortir
dans `src/core/llm/prompts/fr.ts`, à côté du code, et mettre à jour les noms de champs JSON qu'ils citent quand les
schémas passent en anglais. Mesurer la qualité avant et après sur les fixtures (`npm run essai`).

---

## 8. Axes d'amélioration

- **AMEL-01** — CI sur chaque pull request : lint, typecheck, tests, build, `npm audit` (non bloquant), avec
  `permissions: contents: read`. Dependabot pour npm et GitHub Actions.
- **AMEL-02** — Documentation pour contributeurs : `README.md` en anglais (version française en `README.fr.md`),
  `CONTRIBUTING.md` (lancer sans GPU avec `FournisseurMock`/Ollama, conventions, architecture), modèles d'issues et de
  PR, `CODE_OF_CONDUCT.md`, `SECURITY.md` (comment signaler une faille).
- **AMEL-03** — Journal local de diagnostic (fichier tournant dans `userData/logs`, sans données du CV) et bouton
  « Copier le rapport » pour les signalements de bugs, sans télémétrie.
- **AMEL-04** — « Mes CV créés » : les données sont déjà en base ; une liste pour rouvrir et réexporter un CV donnerait
  un sens à leur conservation (sinon, purge : SEC-05).
- **AMEL-05** — Langue du CV produit (anglais), une fois I18N-01 fait : utile pour les annonces en anglais.

---

## Commandes lancées

```
npm run typecheck      → OK
npm run lint           → OK (136 fichiers)
npm test               → OK (28 fichiers, 254 tests, 6,9 s)
npm audit --omit=dev   → 6 vulnérabilités (2 critiques, 1 haute, 3 modérées)
npm outdated           → correctifs mineurs (ai, zod, electron 44.7.2, docx) ; vite 8 et plugin-react 6 en majeures
npm run build          → OK ; renderer 822 kB non minifié, main 129 kB
```
