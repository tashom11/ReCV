# Prompt — audit complet de Re:CV (à coller dans Claude Code, à la racine du dépôt)

---

## 1. Mission

Tu es un ingénieur senior chargé d'auditer **Re:CV**, une application de bureau Windows open source (Electron +
React + TypeScript) qui adapte un CV à une offre d'emploi grâce à un LLM local ou distant. Lis `CLAUDE.md`, `PLAN.md`,
`README.md` et `docs/superpowers/specs/2026-10-13-refonte-graphique-design.md` avant de commencer.

L'audit couvre **tout le dépôt** : `src/core`, `src/main`, `src/preload`, `src/renderer`, `scripts/`, la configuration
(`electron.vite.config.ts`, `electron-builder.yml`, `tsconfig*.json`, `biome.json`, `vitest.config.ts`) et la CI
(`.github/workflows/release.yml`).

**Ne modifie aucun fichier pendant l'audit.** Tu livres d'abord un rapport, puis un plan de correction par lots. Les
corrections viendront ensuite, lot par lot, sur validation.

À ne pas lire : `node_modules/`, `out/`, `dist/`, `release/`, `*.gguf`, `fixtures/*.pdf`, `package-lock.json` (sauf
pour vérifier une version précise).

## 2. Contexte important : passage du code en anglais

Le projet devient un projet open source destiné à une communauté internationale. **Décision prise : tous les
identifiants passent en anglais**, ce qui remplace la règle « code en français » de `CLAUDE.md`.

| Élément | Langue cible |
|---|---|
| Variables, fonctions, types, composants, props, schémas Zod, canaux IPC, tables/colonnes SQLite | anglais |
| Noms de fichiers et de dossiers (`ecrans/` → `screens/`, `MonCv.tsx` → …) | anglais |
| Commentaires, JSDoc, messages de commit, noms des tests (`it(...)`) | anglais |
| Textes affichés à l'utilisateur (libellés, aides, erreurs) | **français**, mais sortis du code (voir § 4.7) |
| Prompts envoyés au LLM | à évaluer : justifier le choix (qualité de sortie en français vs lisibilité pour les contributeurs) |

Pour ce point, l'audit doit produire :
- un **glossaire FR → EN** des termes métier (Profil → `Profile`, Offre → `JobPosting`?, CvAdapte → `TailoredCv`?,
  Accroche → `Summary`?, Fournisseur → `Provider`, Couverture → `Coverage`, Pertinence → `Relevance`, etc.), à
  valider avant tout renommage, en privilégiant les termes du recrutement anglophone ;
- une **stratégie de migration** sans casse : ordre des dossiers, renommage des colonnes et des clés de la base
  SQLite **avec migration des données existantes des utilisateurs** (Drizzle), des clés de paramètres persistés et des
  canaux IPC, compatibilité de `electron-updater` (le nom d'exécutable `ReCV.exe` et l'`appId` ne changent pas) ;
- la mise à jour de `CLAUDE.md` (nouvelle règle de langue) proposée en premier lot.

## 3. Méthode

1. Lance d'abord l'état des lieux et note les résultats bruts : `npm run typecheck`, `npm run lint`, `npm test`,
   `npm audit --omit=dev`, `npm outdated`, puis `npm run build` (taille des bundles dans `out/`).
2. Lis chaque fichier de `src/`. Pour un dépôt de cette taille (~130 fichiers), tu peux répartir le travail entre
   sous-agents par zone (core / main+preload / renderer / build+CI), mais **chaque constat doit être vérifié dans le
   code** avant d'entrer dans le rapport : pas de constat générique ni supposé.
3. Pour chaque constat, cite `fichier:ligne`, décris le problème, le **scénario concret** (entrée → effet), la
   correction proposée et l'effort estimé (S < 1 h, M < 1/2 journée, L > 1/2 journée).
4. Classe par gravité : **Critique** (faille exploitable, perte de données, plantage), **Haute** (bloque un
   utilisateur, notamment en accessibilité), **Moyenne**, **Basse** (confort, style).
5. Distingue ce qui est **constaté** de ce qui est **à vérifier** à l'exécution (ex. comportement avec un lecteur
   d'écran) et indique comment le vérifier.

## 4. Axes de l'audit

### 4.1 Sécurité (priorité haute)

- **Durcissement Electron** : `contextIsolation`, `sandbox`, `nodeIntegration: false`, `webSecurity`, Content
  Security Policy du renderer, blocage de `will-navigate`, `setWindowOpenHandler`, `shell.openExternal` (liste blanche
  de protocoles), permissions (`setPermissionRequestHandler`), `webviewTag`. Croiser avec `src/main/durcissement.test.ts`
  et repérer ce qui n'est pas testé.
- **IPC** (`src/main/ipc.ts`, `src/core/canaux.ts`, `src/preload/`) : chaque entrée venant du renderer est-elle validée
  par un schéma Zod côté main ? Surface exposée minimale ? Pas de passage de chemin de fichier arbitraire.
- **Récupération d'offre** (`src/core/offre/recuperation.ts`, `src/main/offre/rendu.ts`) : schémas d'URL acceptés
  (`file:`, `data:`, adresses locales / réseau privé → SSRF), taille et durée maximales, redirections, isolation de la
  `BrowserWindow` de repli qui exécute du JavaScript tiers (session dédiée, pas de preload, pas de navigation, pas de
  téléchargements).
- **Export** (`src/core/export/`, `src/main/export.ts`) : injection HTML dans le rendu `printToPDF` à partir de données
  issues du CV ou du LLM, échappement, noms de fichiers (traversée de chemin, caractères Windows interdits), photo en
  data URL (type et taille vérifiés).
- **Injection de prompt** : un texte d'offre malveillant peut-il faire sortir le LLM de son rôle, inventer des
  éléments, ou faire fuiter le profil vers un fournisseur distant ? Vérifier que les garde-fous anti-invention
  (`assainissement`, `coherence`, `garde`) s'appliquent à toutes les sorties.
- **Secrets** : stockage de la clé API via `safeStorage`, comportement si le chiffrement est indisponible, clé jamais
  journalisée ni renvoyée au renderer en clair.
- **Téléchargement de modèles** (`src/main/modeles/`) : URL figées, vérification d'intégrité (SHA-256), reprise sans
  corruption, espace disque, écriture atomique.
- **Mises à jour et CI** : signature, `permissions:` minimales du workflow, actions épinglées par SHA, secrets
  exposés aux étapes nécessaires seulement, contenu de `latest.yml`.
- **Expressions régulières** sur du texte non maîtrisé (CV, offres) : risque de ReDoS.
- **Dépendances** : vulnérabilités connues, paquets abandonnés, dépendances inutiles.

### 4.2 Accessibilité (priorité haute)

Référence : **WCAG 2.2 niveau AA**, et le public visé (personnes peu à l'aise avec l'informatique, parfois
malvoyantes ou âgées). Pour chaque écran de `src/renderer/src/ecrans/` et chaque composant de `src/renderer/src/ui/` :

- **Clavier** : tout le parcours (accueil → CV → annonce → création → export) faisable sans souris, ordre de
  tabulation logique, aucun piège, raccourcis éventuels documentés, `ZoneDepot` activable au clavier.
- **Focus** : visible partout (contraste ≥ 3:1), **déplacé et annoncé à chaque changement d'étape ou d'écran**,
  restitué à la fermeture d'une section repliable ou d'une boîte de dialogue.
- **Lecteurs d'écran** (NVDA, Narrateur) : sémantique HTML native avant ARIA, `lang="fr"`, titres hiérarchisés, un seul
  `h1` par écran, libellés reliés aux champs, erreurs de formulaire reliées (`aria-describedby`, `aria-invalid`),
  `aria-live` sur les chargements et les résultats sans saturer, stepper exposé correctement (`aria-current="step"`),
  icônes décoratives masquées, icônes porteuses de sens nommées, aperçus de modèles décrits.
- **Visuel** : contrastes texte ≥ 4.5:1 (≥ 3:1 pour les grands textes et les composants) calculés **à partir des
  tokens réels** de `index.css`, information jamais portée par la couleur seule, zoom 200 % et texte agrandi de Windows
  sans perte, cibles ≥ 24 px (idéalement 44 px), mode **Contraste élevé de Windows** (`forced-colors`).
- **Mouvement et temps** : `prefers-reduced-motion` respecté par toutes les animations (lignes du CV, transitions),
  aucun délai imposé, chargements longs annulables.
- **Langage** : textes simples, erreurs qui disent quoi faire.

Livrer un tableau par écran : critère WCAG, constat, gravité, correction. Proposer en plus des tests automatisés
réalistes (ex. `axe-core` sur les composants rendus dans Vitest) **en signalant la dépendance à ajouter**.

### 4.3 Découpage en composants et architecture du renderer

Fichiers à examiner en priorité : `ecrans/MonCv.tsx` (~550 lignes), `ecrans/Reglages.tsx` (~500), `App.tsx` (~310),
`ui/structure.tsx` (~270), `ecrans/Annonce.tsx`, `ecrans/NouveauCv.tsx`.

- Tout bloc d'interface réutilisé, ou qui forme une unité de sens (une section du profil, une carte de réglage, une
  ligne d'expérience, la barre d'actions…), doit devenir un composant dans son propre fichier.
- Séparer la logique (état, appels `window.api.*`, effets) de l'affichage : hooks dédiés (`useProfile`,
  `useTailoring`…), composants de présentation sans effets de bord.
- `App.tsx` : machine d'états du parcours, gestion des transitions, risque de « god component ».
- `ui/structure.tsx` : un fichier qui regroupe plusieurs composants doit être éclaté (un composant par fichier).
- Props : typage précis, pas de props inutilisées, pas de « prop drilling » profond (contexte si justifié).
- Proposer l'arborescence cible (`screens/`, `components/`, `hooks/`, `ui/`) avec les noms anglais du glossaire.

### 4.4 Bonnes pratiques et qualité du code

- TypeScript strict réellement exploité : pas de `any`, d'assertions `as` injustifiées, de `!` non nécessaires ;
  types dérivés des schémas Zod (`z.infer`) plutôt que dupliqués.
- Frontière `src/core` pure respectée : aucun import Electron, Node UI ou DOM dans `core` (vérifier `CvHtml.tsx`,
  `recuperation.ts`, `moteurLocal.ts`).
- Gestion d'erreurs : erreurs typées (`src/core/erreurs.ts`), pas d'erreur avalée, messages utilisateur séparés des
  messages techniques, journalisation utile au diagnostic sans données personnelles.
- Code mort, doublons (ex. fonctions de normalisation de texte répétées dans `adaptation/`, `offre/`), constantes
  magiques à nommer, fonctions trop longues.
- Respect de la règle « le LLM n'invente jamais » et « toute sortie LLM passe par un schéma Zod » : lister toute
  exception.
- Couverture de tests : zones critiques non testées (renderer, export DOCX, migrations, IPC), tests fragiles, usage
  systématique de `FournisseurMock`.
- Cohérence avec Biome, conventions de nommage, organisation des `index.ts` (barrels utiles ou nuisibles).
- Documentation pour contributeurs : `README.md` (en anglais ?), `CONTRIBUTING.md`, architecture, comment lancer et
  tester sans GPU.

### 4.5 Performance

- **Démarrage** : temps jusqu'à la première fenêtre, travail synchrone dans `src/main/index.ts`, chargement de
  `node-llama-cpp` (import dynamique, différé jusqu'au premier usage), ouverture SQLite.
- **Process principal bloqué** : parsing PDF/DOCX, génération DOCX, `better-sqlite3` (synchrone), nettoyage de texte
  lourd. Faut-il un `utilityProcess` ou un worker ?
- **LLM** : nombre d'appels par adaptation, taille des prompts (tokens), parallélisation possible, cache d'analyse,
  réutilisation du contexte, libération de la mémoire du modèle, comportement CPU seul.
- **Renderer** : rendus inutiles (mémoïsation ciblée, pas systématique), taille du bundle, polices embarquées (sous-
  ensembles, formats `woff2`), image du logo, coût de la galerie d'aperçus (combien de `printToPDF` ou de rendus par
  ouverture ? mise en cache ?), animations sur `transform`/`opacity` uniquement.
- **Paquet installé** : taille de l'installateur NSIS, fichiers inutiles embarqués (`asar`, `files` de
  `electron-builder.yml`), modules natifs.

Chaque constat de performance doit donner une **mesure** ou la façon de mesurer (ex. `performance.now()`,
`--inspect`, profil React DevTools, taille des fichiers dans `out/`).

### 4.6 Robustesse et données

- Migrations Drizzle (versionnées, réversibles ?), base corrompue, dossier `userData` inaccessible.
- Fichiers d'entrée extrêmes : CV vide, scanné (image seule), énorme, chiffré, mal encodé ; offre vide ou très longue.
- Annulation, double clic, fermeture de l'application pendant une adaptation ou un téléchargement.
- Fonctionnement hors ligne complet une fois le modèle installé.

### 4.7 Axes d'amélioration

- **Internationalisation** : extraire tous les textes affichés dans des fichiers de traduction (le français restant la
  langue par défaut), pour permettre l'anglais plus tard. Proposer une solution légère sans dépendance si possible.
- Expérience utilisateur : points de friction restants dans le parcours en trois étapes.
- Outillage : hooks de pré-commit, CI de vérification sur chaque PR (typecheck, lint, tests, build), Dependabot ou
  Renovate, modèles d'issues et de PR.
- Fonctionnalités à fort impact et faible coût, **sans promettre** ce qui contredirait les principes du projet (pas de
  compte, pas de télémétrie, pas d'invention par le LLM).

## 5. Livrables

Écrire dans `docs/audit/` :

1. `AUDIT.md` : résumé (une page, les 10 constats les plus graves en tête), puis un chapitre par axe, constats triés
   par gravité au format :

   ```
   ### [SEC-03] Haute — La fenêtre de repli charge l'offre avec la session par défaut
   - Où : src/main/offre/rendu.ts:21
   - Constat : …
   - Scénario : …
   - Correction : …
   - Effort : S
   ```

   Préfixes : `SEC` sécurité, `A11Y` accessibilité, `ARCH` découpage/architecture, `QUAL` qualité, `PERF` performance,
   `ROB` robustesse, `I18N`, `AMEL` amélioration.
2. `GLOSSAIRE.md` : correspondance FR → EN de tous les termes métier et noms de fichiers.
3. `PLAN-CORRECTIONS.md` : lots ordonnés, chacun livrable seul, vérifiable et dans un commit séparé. Ordre conseillé :
   (1) failles critiques et hautes, (2) mise à jour de `CLAUDE.md` et glossaire validé, (3) renommage en anglais par
   zone, `core` d'abord, avec migration de la base, (4) découpage des composants, (5) accessibilité, (6) performance,
   (7) i18n et outillage. Pour chaque lot : constats couverts, fichiers touchés, risques, commandes de vérification.

## 6. Règles

- Pendant l'audit, **lecture seule** : aucune modification, aucun commit.
- Aucune nouvelle dépendance sans la signaler explicitement, avec sa taille et une alternative sans dépendance.
- Pas d'appel LLM réel dans les tests (`FournisseurMock`).
- `Re:CV` ne doit jamais apparaître dans un chemin, un nom de fichier ou `productName`.
- Ne pas toucher aux modèles de CV exportés au-delà de la sécurité et de l'accessibilité du document produit (ils sont
  conçus pour les logiciels de recrutement).
- Sois factuel : si un point est déjà correctement traité, dis-le en une ligne plutôt que d'inventer un problème.
- Termine par les commandes de vérification lancées et leurs résultats réels.
