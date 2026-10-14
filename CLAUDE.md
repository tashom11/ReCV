# Re:CV — contexte projet

Nom affiché : `Re:CV`. Identifiant technique : `recv` (package npm, appId `org.recv.app`, nom d'exécutable `ReCV.exe`).
⚠️ Les `:` sont interdits dans les noms de fichiers Windows : ne jamais utiliser `Re:CV` dans un chemin, un nom d'artefact ou d'exécutable.
   Ni dans `productName` (package.json / electron-builder) : Electron en dérive le dossier `userData` et plante au démarrage (0xC0000005). `Re:CV` uniquement dans les titres affichés.

App bureau Windows open source (gratuite) : import d'un CV (PDF/DOCX) → profil structuré → récupération d'une offre (URL ou texte collé) → CV adapté exporté en PDF/DOCX, optimisé ATS.

## Stack
- Electron + electron-vite + React + TypeScript strict + Tailwind
- Zod pour tous les schémas (source de vérité des types)
- SQLite : better-sqlite3 + Drizzle
- LLM : Vercel AI SDK (`ai`) pour Ollama / BYOK, `node-llama-cpp` pour le modèle embarqué (JSON Schema → grammaire)
- Tests : Vitest. Lint/format : Biome
- Packaging : electron-builder (NSIS), electron-updater, GitHub Actions

## Architecture
- `src/core/` : logique métier PURE (aucun import Electron/Node UI). Testable seule.
  - `schemas/` (Profil, Offre, CvAdapte), `parsing/`, `offre/`, `llm/` (interface `FournisseurLLM`), `adaptation/`
- `src/main/` : process principal, IPC, BDD, safeStorage, téléchargement modèles
- `src/preload/` : API typée exposée via contextBridge (jamais de nodeIntegration)
- `src/renderer/` : UI React

## Règles
- Code en ANGLAIS (projet open source) : identifiants, noms de fichiers/dossiers, commentaires, noms de tests,
  messages de commit. Conventions TypeScript/React standard (camelCase, PascalCase pour types et composants).
  Le code existant est encore en français : migration en cours (glossaire dans `docs/audit/GLOSSAIRE.md`) ;
  tout code nouveau ou réécrit est en anglais.
- Textes affichés à l'utilisateur en FRANÇAIS (vouvoiement), hors du code de logique.
- Le LLM ne doit JAMAIS inventer : il reformule/priorise uniquement ce qui existe dans le profil.
- Toute sortie LLM passe par un schéma Zod validé.
- En test, utiliser `FournisseurMock` (jamais d'appel LLM réel dans Vitest).
- Pas de nouvelle dépendance sans le signaler.
- Changements minimaux, ciblés : ne pas réécrire un fichier entier pour une petite modif.

## Commandes
- `npm run dev` | `npm test` | `npm run lint` | `npm run typecheck` | `npm run build:win`
- `npm run try -- cv.txt job-posting.txt [--provider ollama|api|local] [--model name]` : pipeline complet hors Electron (config via `RECV_OLLAMA_URL`, `RECV_API_URL`, `RECV_API_KEY`, `RECV_GGUF_MODEL`)
- `node-llama-cpp` est ESM avec top-level await : toujours l'importer dynamiquement (`await import(...)`), jamais en import statique de valeur.

## À ne pas lire
`node_modules/`, `out/`, `dist/`, `release/`, `*.gguf`, `fixtures/*.pdf` (utiliser les `.txt` extraits)
