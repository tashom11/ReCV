# Plan d'action Claude Code — Re:CV

## Règles d'économie de tokens (à appliquer tout le long)

1. **Une phase = une session.** `/clear` entre chaque phase. Le `CLAUDE.md` + ce plan suffisent pour reprendre.
2. **Plan mode d'abord** (Shift+Tab) sur chaque phase : tu valides le plan, puis il code. Évite les allers-retours coûteux.
3. **Bon modèle au bon moment** (`/model`) :
   - `opus` : phase 0 (architecture) et phase 2 (prompts LLM) uniquement
   - `sonnet` : tout le reste
   - `haiku` : renommages, petites corrections, doc
4. **Cibler les fichiers avec `@chemin`** au lieu de laisser Claude explorer le repo.
5. **`/compact`** si une session s'allonge, **`/cost`** pour surveiller.
6. **Tests = auto-vérification.** Claude lance `npm test` lui-même au lieu de te demander de vérifier → moins d'échanges.
7. **Commit à chaque phase validée** (`git commit`), pour pouvoir `/clear` sans peur.
8. **Ne colle jamais un log entier** : seulement l'erreur utile.
9. **Bloquer la lecture des gros dossiers** dans `.claude/settings.json` :
   ```json
   {
     "permissions": {
       "deny": ["Read(./node_modules/**)", "Read(./out/**)", "Read(./dist/**)", "Read(./release/**)", "Read(./**/*.gguf)"]
     }
   }
   ```
10. **Pas de vrai LLM pendant le dev du code** : `FournisseurMock` partout, on branche les vrais modèles en phase 2 seulement.

---

## Phase 0 — Squelette du projet · `opus` · plan mode

**Prompt :**
> Initialise le projet décrit dans @CLAUDE.md avec electron-vite (template react-ts), Tailwind, Biome, Vitest. Crée l'arborescence `src/core`, `src/main`, `src/preload`, `src/renderer` avec des fichiers index vides. Ajoute les scripts npm listés dans CLAUDE.md et le `.claude/settings.json` décrit dans @PLAN.md. Ne code aucune fonctionnalité.

**Terminé quand :** `npm run dev` ouvre une fenêtre, `npm test` et `npm run typecheck` passent.

---

## Phase 1 — Cœur métier sans LLM · `sonnet`

**Prompt :**
> Dans `src/core` : 1) schémas Zod `Profil`, `Offre`, `CvAdapte` (expériences, compétences, formations, langues, titre, accroche). 2) `parsing/` : extraction texte PDF (unpdf) et DOCX (mammoth). 3) `llm/` : interface `FournisseurLLM` avec `extraireProfil`, `extraireOffre`, `adapterCv`, plus `FournisseurMock` qui renvoie des fixtures. 4) Tests Vitest sur 2 fixtures texte dans `fixtures/`. Pas d'Electron, pas d'UI.

**Terminé quand :** les tests passent avec le mock.

---

## Phase 2 — Fournisseurs LLM et prompts · `opus` · plan mode

**Prompt :**
> Implémente `FournisseurOllama` et `FournisseurApi` (BYOK) via le Vercel AI SDK avec sorties structurées Zod, et `FournisseurLocal` via node-llama-cpp avec grammaire JSON Schema. Découpe l'adaptation en étapes : mots-clés de l'offre → classement des expériences → réécriture expérience par expérience → titre + accroche. Les prompts interdisent explicitement d'inventer. Ajoute un script CLI `npm run essai -- cv.txt offre.txt` pour tester le pipeline hors Electron.

**Terminé quand :** le CLI produit un `CvAdapte` valide avec Ollama sur une vraie offre.

---

## Phase 3 — Récupération des offres · `sonnet`

**Prompt :**
> Dans `src/core/offre` : récupération par `fetch` + `@mozilla/readability`. Dans `src/main` : fallback via BrowserWindow cachée pour les pages en JS. Toujours retourner une erreur claire si échec, pour que l'UI propose de coller le texte. Tests avec du HTML en fixture (aucune requête réseau dans les tests).

---

## Phase 4 — Process principal Electron · `sonnet`

**Prompt :**
> Dans `src/main` : BDD SQLite (Drizzle) pour profils, offres et CV générés ; stockage chiffré des clés API avec `safeStorage` ; handlers IPC typés qui appellent `src/core`. Dans `src/preload` : API typée via contextBridge. contextIsolation activé, nodeIntegration désactivé.

---

## Phase 5 — Interface React · `sonnet`

**Prompt :**
> Écrans : 1) import CV + édition du profil extrait, 2) saisie offre (URL ou texte), 3) vue diff avant/après avec validation par l'utilisateur, 4) paramètres (choix du fournisseur : local / Ollama / clé API, avec avertissement données personnelles pour les offres gratuites). Utilise uniquement l'API du preload.

**Astuce tokens :** une session par écran si ça s'allonge.

---

## Phase 6 — Export · `sonnet`

**Prompt :**
> Template React de CV optimisé ATS (une colonne, texte réel, titres de section standards). Export PDF via `webContents.printToPDF()` sur une fenêtre cachée, export DOCX via la lib `docx`.

---

## Phase 7 — Modèle embarqué · `sonnet`

**Prompt :**
> Gestionnaire de modèles : détection RAM/VRAM via node-llama-cpp, proposition du modèle adapté (Qwen3.5-2B / 4B / 9B), téléchargement depuis Hugging Face au premier lancement avec barre de progression et reprise, stockage dans `app.getPath('userData')`.

---

## Phase 8 — Distribution · `sonnet`

**Prompt :**
> Configure electron-builder (NSIS Windows), electron-updater sur GitHub Releases, et un workflow GitHub Actions qui build et publie sur tag `v*`. Prévois l'étape de signature (SignPath) en commentaire, désactivée pour l'instant. Ajoute README (FR + EN) et licence.

---

## Phase 9 — Audit · `sonnet` · lecture seule

**Prompt :**
> Audit sécurité et qualité du repo (IPC, preload, stockage des clés, injection via contenu d'offre dans les prompts). Rapport uniquement : constats + gravité, aucune correction.
