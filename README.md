# Re:CV

🇫🇷 [Français](#français) · 🇬🇧 [English](#english)

---

## Français

**Re:CV** adapte ton CV à chaque offre d'emploi, en local. Application bureau Windows, gratuite et open source.

1. Importe ton CV (PDF ou DOCX) : il est converti en profil structuré que tu peux corriger.
2. Donne une offre (lien ou texte collé).
3. Compare le CV adapté avec l'original, accepte ou corrige chaque partie.
4. Exporte en PDF ou DOCX, mis en page pour les logiciels de recrutement (ATS).

### Principe : le modèle n'invente rien

Le modèle de langage reformule et priorise uniquement ce qui existe dans ton profil. Postes, entreprises, dates, formations et langues sont recopiés tels quels, jamais générés. Tu valides le résultat avant tout export.

### Où tournent les données ?

| Fournisseur | Où va ton CV ? |
|---|---|
| **Modèle embarqué** (par défaut) | Reste sur ton ordinateur. Téléchargé une fois depuis Hugging Face (Qwen3.5 2B / 4B / 9B selon ta mémoire). |
| **Ollama** | Reste sur ton ordinateur (ou l'adresse que tu indiques). |
| **API en ligne** (clé personnelle) | Envoyé au service choisi. Les offres gratuites peuvent utiliser les données pour entraîner leurs modèles : vérifie leurs conditions. |

Ta clé API est chiffrée avec le chiffrement du système (`safeStorage`) et n'est jamais réaffichée.
L'application installée vérifie les mises à jour auprès de GitHub au démarrage ; hors choix du fournisseur, téléchargement du modèle et récupération d'offres, c'est sa seule connexion.

### Installer

Télécharge `ReCV-Setup-<version>.exe` depuis les [Releases](../../releases).
Tant que l'installeur n'est pas signé, Windows SmartScreen peut afficher un avertissement : « Informations complémentaires » puis « Exécuter quand même ».

### Développer

Prérequis : Node.js 24+, Windows.

```bash
npm install
npm run dev          # application en mode développement
npm test             # tests (Vitest, aucun appel LLM réel)
npm run lint         # Biome
npm run typecheck
npm run build:win    # installeur NSIS dans release/
npm run essai -- fixtures/cv-exemple.txt fixtures/offre-exemple.txt   # pipeline complet hors Electron
```

Variables du script `essai` : `RECV_OLLAMA_URL`, `RECV_API_URL`, `RECV_API_CLE`, `RECV_MODELE_GGUF`.

Architecture : `src/core` (logique métier pure) · `src/main` (process principal, BDD, IPC) · `src/preload` (pont typé) · `src/renderer` (React).

### Publier une version

Mettre à jour `version` dans `package.json`, puis `git tag v<version> && git push --tags` : le workflow GitHub Actions construit l'installeur et le publie sur la release.

### Licence

[MIT](LICENSE)

---

## English

**Re:CV** tailors your résumé to each job posting, locally. A free, open-source Windows desktop app.

1. Import your résumé (PDF or DOCX): it becomes a structured profile you can correct.
2. Provide a job posting (link or pasted text).
3. Compare the tailored résumé with the original, and accept or edit each part.
4. Export as PDF or DOCX, laid out for applicant tracking systems (ATS).

### Principle: the model never invents anything

The language model only rephrases and prioritizes what already exists in your profile. Job titles, employers, dates, education and languages are copied verbatim, never generated. You review the result before any export.

### Where does your data go?

| Provider | Where does your résumé go? |
|---|---|
| **Embedded model** (default) | Stays on your computer. Downloaded once from Hugging Face (Qwen3.5 2B / 4B / 9B depending on your memory). |
| **Ollama** | Stays on your computer (or the address you configure). |
| **Online API** (your own key) | Sent to the chosen service. Free tiers may use submitted data for training: check their terms. |

Your API key is encrypted with the operating system's encryption (`safeStorage`) and is never displayed again.
The installed app checks GitHub for updates at startup; besides your chosen provider, the model download and job-posting fetches, this is its only connection.

### Install

Download `ReCV-Setup-<version>.exe` from [Releases](../../releases).
Until the installer is signed, Windows SmartScreen may show a warning: click "More info" then "Run anyway".

### Develop

Requirements: Node.js 24+, Windows.

```bash
npm install
npm run dev          # app in development mode
npm test             # tests (Vitest, no real LLM calls)
npm run lint         # Biome
npm run typecheck
npm run build:win    # NSIS installer in release/
npm run essai -- fixtures/cv-exemple.txt fixtures/offre-exemple.txt   # full pipeline without Electron
```

`essai` script variables: `RECV_OLLAMA_URL`, `RECV_API_URL`, `RECV_API_CLE`, `RECV_MODELE_GGUF`.

Architecture: `src/core` (pure business logic) · `src/main` (main process, DB, IPC) · `src/preload` (typed bridge) · `src/renderer` (React).

### Release

Bump `version` in `package.json`, then `git tag v<version> && git push --tags`: the GitHub Actions workflow builds the installer and publishes it to the release.

### License

[MIT](LICENSE)
