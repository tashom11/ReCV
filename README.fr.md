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

[**Télécharger pour Windows**](https://github.com/tashom11/ReCV/releases/latest) · 🇬🇧 [English](README.md)

<img src="docs/captures/accueil.png" alt="Écran d’accueil de Re:CV : « Un CV adapté à chaque annonce, en quelques minutes. »" width="820">

</div>

---

Re:CV lit votre CV, lit l’annonce qui vous intéresse, puis met en avant ce qui compte pour ce poste. Vous relisez, vous ajustez, et vous repartez avec un PDF ou un fichier Word.

## Trois étapes

| | |
|---|---|
| **① Mon CV** | Déposez votre CV (PDF ou Word). Re:CV vous montre ce qu’il a compris ; vous corrigez si besoin. |
| **② L’annonce** | Collez le lien de l’annonce, ou son texte. Re:CV affiche le poste et ce que l’employeur recherche. |
| **③ Mon nouveau CV** | Le CV adapté s’affiche en grand. Vous choisissez la mise en page, puis vous téléchargez. |

<p align="center">
  <img src="docs/captures/annonce.png" alt="Étape 2 : la carte de l’annonce, avec le poste et ce que l’employeur recherche" width="49%">
  <img src="docs/captures/creation.png" alt="Création du CV adapté, étape par étape" width="49%">
</p>

## Rien n’est inventé

Re:CV choisit, réordonne et reformule uniquement ce qui se trouve déjà dans votre CV. Vos postes, vos entreprises, vos dates, vos formations et vos langues sont recopiés tels quels.

Quand l’annonce demande une compétence absente de votre CV, elle vous est proposée dans une case **décochée** : elle n’entre dans le CV que si vous la cochez.

## Où vont vos données ?

| Moteur choisi dans les Réglages | Où va votre CV ? |
|---|---|
| **Sur mon ordinateur** (par défaut) | Nulle part. Un modèle est téléchargé une seule fois (1,2 à 5,3 Go selon le niveau : Rapide, Équilibré ou Soigné), puis tout fonctionne sans internet. |
| **Ollama** | Il reste sur votre ordinateur, ou va à l’adresse que vous indiquez. |
| **Service en ligne** (votre clé personnelle) | Il est envoyé au service choisi à chaque création. Certaines offres gratuites réutilisent les données reçues : lisez leurs conditions. |

Votre clé personnelle est chiffrée par Windows et n’est jamais réaffichée. Il n’y a ni compte, ni publicité, ni mesure d’audience. Un journal de diagnostic local ne garde que des codes d’erreur (jamais de message ni de donnée du CV) ; il ne quitte votre ordinateur que si vous copiez le rapport depuis les Réglages pour un signalement.

En dehors du moteur choisi, Re:CV ne se connecte à internet que pour télécharger le modèle, lire une annonce à partir d’un lien et vérifier les mises à jour.

## Installer

1. Téléchargez `ReCV-Setup-<version>.exe` depuis la [dernière version](https://github.com/tashom11/ReCV/releases/latest).
2. Lancez-le. L’installeur n’est pas encore signé : Windows SmartScreen affiche un avertissement. Cliquez sur « Informations complémentaires », puis « Exécuter quand même ».
3. Au premier lancement, Re:CV télécharge le modèle. Comptez quelques minutes.

## Mises à jour

Re:CV vérifie les nouvelles versions au démarrage, puis toutes les six heures. Une mise à jour se télécharge en arrière-plan et s’installe à la fermeture de l’application. Dans les Réglages, la carte « Mises à jour » indique la version installée et permet de lancer une vérification.

## Un problème, une idée ?

Ouvrez un [ticket](https://github.com/tashom11/ReCV/issues/new/choose) et collez-y le rapport de diagnostic (Réglages → « Signaler un problème ») : il y a un formulaire pour signaler un problème et un autre pour proposer une idée. Vous pouvez écrire en français. Pour une faille de sécurité, suivez plutôt [SECURITY.md](SECURITY.md).

## Développer

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
| `src/renderer` | Interface React. Tous les textes affichés sont dans `src/renderer/src/i18n/fr.ts`. |

Le code, les noms et les commentaires sont en anglais ; l’interface et les prompts sont en français. Pour contribuer, lisez [CONTRIBUTING.md](CONTRIBUTING.md).

## Publier une version

Ajoutez d’abord la section de la version dans [CHANGELOG.md](CHANGELOG.md) (en anglais) : elle devient le texte de la
release, et la publication échoue sans elle. Après un changement de dépendances, lancez aussi
`node scripts/third-party-notices.mjs` et commitez [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

```bash
npm version 0.6.0 --no-git-tag-version
git commit -am "Version 0.6.0"
git tag v0.6.0
git push origin main v0.6.0
```

Le workflow GitHub Actions construit l’installeur, le dépose sur une release en brouillon avec la section du changelog pour texte, puis la publie. Le tag doit correspondre à la version de `package.json`.

## Licence

[MIT](LICENSE)
