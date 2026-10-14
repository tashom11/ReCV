<div align="center">

<h1>
  <img src="build/icon.png" alt="" width="96" height="96"><br>
  Re:CV
</h1>

**Un CV adapté à chaque annonce, en quelques minutes.**<br>
Application Windows gratuite et open source. Votre CV reste sur votre ordinateur.

[![Dernière version](https://img.shields.io/github/v/release/tashom11/ReCV?label=version&color=23624A)](https://github.com/tashom11/ReCV/releases/latest)
[![Licence MIT](https://img.shields.io/badge/licence-MIT-23624A)](LICENSE)
![Windows 10 et 11](https://img.shields.io/badge/Windows-10%20%7C%2011-1E2622)

[**Télécharger pour Windows**](https://github.com/tashom11/ReCV/releases/latest) · 🇫🇷 [Français](#français) · 🇬🇧 [English](#english)

<img src="docs/captures/accueil.png" alt="Écran d’accueil de Re:CV : « Un CV adapté à chaque annonce, en quelques minutes. »" width="820">

</div>

---

## Français

Re:CV lit votre CV, lit l’annonce qui vous intéresse, puis met en avant ce qui compte pour ce poste. Vous relisez, vous ajustez, et vous repartez avec un PDF ou un fichier Word.

### Trois étapes

| | |
|---|---|
| **① Mon CV** | Déposez votre CV (PDF ou Word). Re:CV vous montre ce qu’il a compris ; vous corrigez si besoin. |
| **② L’annonce** | Collez le lien de l’annonce, ou son texte. Re:CV affiche le poste et ce que l’employeur recherche. |
| **③ Mon nouveau CV** | Le CV adapté s’affiche en grand. Vous choisissez la mise en page, puis vous téléchargez. |

<p align="center">
  <img src="docs/captures/annonce.png" alt="Étape 2 : la carte de l’annonce, avec le poste et ce que l’employeur recherche" width="49%">
  <img src="docs/captures/creation.png" alt="Création du CV adapté, étape par étape" width="49%">
</p>

### Rien n’est inventé

Re:CV choisit, réordonne et reformule uniquement ce qui se trouve déjà dans votre CV. Vos postes, vos entreprises, vos dates, vos formations et vos langues sont recopiés tels quels.

Quand l’annonce demande une compétence absente de votre CV, elle vous est proposée dans une case **décochée** : elle n’entre dans le CV que si vous la cochez.

### Où vont vos données ?

| Moteur choisi dans les Réglages | Où va votre CV ? |
|---|---|
| **Sur mon ordinateur** (par défaut) | Nulle part. Un modèle est téléchargé une seule fois (1,2 à 5,3 Go selon le niveau : Rapide, Équilibré ou Soigné), puis tout fonctionne sans internet. |
| **Ollama** | Il reste sur votre ordinateur, ou va à l’adresse que vous indiquez. |
| **Service en ligne** (votre clé personnelle) | Il est envoyé au service choisi à chaque création. Certaines offres gratuites réutilisent les données reçues : lisez leurs conditions. |

Votre clé personnelle est chiffrée par Windows et n’est jamais réaffichée. Il n’y a ni compte, ni publicité, ni mesure d’audience.

En dehors du moteur choisi, Re:CV ne se connecte à internet que pour télécharger le modèle, lire une annonce à partir d’un lien et vérifier les mises à jour.

### Installer

1. Téléchargez `ReCV-Setup-<version>.exe` depuis la [dernière version](https://github.com/tashom11/ReCV/releases/latest).
2. Lancez-le. L’installeur n’est pas encore signé : Windows SmartScreen affiche un avertissement. Cliquez sur « Informations complémentaires », puis « Exécuter quand même ».
3. Au premier lancement, Re:CV télécharge le modèle. Comptez quelques minutes.

### Mises à jour

Re:CV vérifie les nouvelles versions au démarrage, puis toutes les six heures. Une mise à jour se télécharge en arrière-plan et s’installe à la fermeture de l’application. Dans les Réglages, la carte « Mises à jour » indique la version installée et permet de lancer une vérification.

### Développer

Prérequis : Node.js 24 ou plus, Windows.

```bash
npm install
npm run dev          # application en mode développement
npm test             # tests (Vitest, aucun appel réel à un modèle)
npm run lint         # Biome
npm run typecheck
npm run build:win    # installeur NSIS dans release/
npm run try -- fixtures/sample-cv.txt fixtures/sample-job-posting.txt   # adaptation complète hors Electron
```

Options du script `try` : `--provider ollama|api|local`, `--model nom`. Variables : `RECV_OLLAMA_URL`, `RECV_API_URL`,
`RECV_API_KEY`, `RECV_GGUF_MODEL`.

| Dossier | Rôle |
|---|---|
| `src/core` | Logique métier pure : schémas, lecture du CV et de l’annonce, adaptation, export. |
| `src/main` | Process principal : base de données, IPC, modèles, mises à jour. |
| `src/preload` | Pont typé entre l’interface et le process principal. |
| `src/renderer` | Interface React. |

### Publier une version

```bash
npm version 0.3.0 --no-git-tag-version
git commit -am "Version 0.3.0"
git tag v0.3.0
git push origin main v0.3.0
```

Le workflow GitHub Actions construit l’installeur, le dépose sur une release en brouillon, puis la publie. Le tag doit correspondre à la version de `package.json`.

### Licence

[MIT](LICENSE)

---

## English

Re:CV reads your résumé, reads the job posting you are interested in, then brings forward what matters for that job. You review, adjust, and leave with a PDF or a Word file. The interface is in French.

### Three steps

| | |
|---|---|
| **① My résumé** | Drop your résumé (PDF or Word). Re:CV shows what it understood; you correct it if needed. |
| **② The posting** | Paste the link to the posting, or its text. Re:CV shows the job and what the employer is looking for. |
| **③ My new résumé** | The tailored résumé is shown full size. You pick a layout, then download. |

### Nothing is invented

Re:CV only selects, reorders and rephrases what is already in your résumé. Job titles, employers, dates, education and languages are copied verbatim.

When the posting asks for a skill your résumé does not mention, it is offered as an **unchecked** box: it only enters the résumé if you check it.

### Where does your data go?

| Engine chosen in Settings | Where does your résumé go? |
|---|---|
| **On my computer** (default) | Nowhere. A model is downloaded once (1.2 to 5.3 GB depending on the level), then everything works offline. |
| **Ollama** | It stays on your computer, or goes to the address you configure. |
| **Online service** (your own key) | It is sent to the chosen service on every run. Some free tiers reuse submitted data: read their terms. |

Your key is encrypted by Windows and never displayed again. There is no account, no advertising and no analytics.

Besides the chosen engine, Re:CV only goes online to download the model, read a posting from a link and check for updates.

### Install

1. Download `ReCV-Setup-<version>.exe` from the [latest release](https://github.com/tashom11/ReCV/releases/latest).
2. Run it. The installer is not signed yet, so Windows SmartScreen shows a warning. Click “More info”, then “Run anyway”.
3. On first launch, Re:CV downloads the model. Allow a few minutes.

### Updates

Re:CV checks for new versions at startup, then every six hours. An update downloads in the background and installs when the app closes. In Settings, the “Mises à jour” card shows the installed version and lets you check on demand.

### Develop

Requirements: Node.js 24 or later, Windows.

```bash
npm install
npm run dev          # app in development mode
npm test             # tests (Vitest, no real model calls)
npm run lint         # Biome
npm run typecheck
npm run build:win    # NSIS installer in release/
npm run try -- fixtures/sample-cv.txt fixtures/sample-job-posting.txt   # full tailoring run without Electron
```

`try` script options: `--provider ollama|api|local`, `--model name`. Variables: `RECV_OLLAMA_URL`, `RECV_API_URL`,
`RECV_API_KEY`, `RECV_GGUF_MODEL`.

| Folder | Role |
|---|---|
| `src/core` | Pure business logic: schemas, résumé and posting parsing, tailoring, export. |
| `src/main` | Main process: database, IPC, models, updates. |
| `src/preload` | Typed bridge between the interface and the main process. |
| `src/renderer` | React interface. |

Code, names and comments are written in French.

### Release

```bash
npm version 0.3.0 --no-git-tag-version
git commit -am "Version 0.3.0"
git tag v0.3.0
git push origin main v0.3.0
```

The GitHub Actions workflow builds the installer, uploads it to a draft release, then publishes it. The tag must match the version in `package.json`.

### License

[MIT](LICENSE)
