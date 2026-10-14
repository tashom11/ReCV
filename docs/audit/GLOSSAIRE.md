# Glossaire FR → EN (à valider avant tout renommage)

Règles : vocabulaire du recrutement anglophone ; camelCase pour variables et fonctions, PascalCase pour types et
composants, kebab-case pour les canaux IPC, snake_case pour SQLite. Une fois validé, ce glossaire fait foi.

## 1. Termes métier

| Français | Anglais | Remarque |
|---|---|---|
| Profil | `Profile` | |
| Offre / annonce | `JobPosting` | un seul terme pour les deux mots français |
| CV adapté | `TailoredCv` | |
| Adaptation (adapter le CV) | `tailoring` (`tailorCv`) | |
| Accroche / phrase de présentation | `summary` | « professional summary » |
| Titre du poste (profil) | `headline` | titre affiché sous le nom |
| Intitulé du poste (offre) | `jobTitle` | |
| Expérience | `Experience` | |
| Poste | `position` | |
| Entreprise | `company` | |
| Lieu | `location` | |
| Période | `dateRange` | |
| Réalisations | `achievements` | |
| Puces / points | `bullets` | |
| Formation | `Education` | |
| Diplôme | `degree` | |
| Établissement | `school` | |
| Langue / niveau | `Language` / `level` | |
| Liens professionnels | `links` | |
| Compétences | `skills` | |
| Compétences clés | `keySkills` | |
| Savoir-être / qualités | `softSkills` | `qualites` de l'analyse → `softSkills` |
| Outils et techniques | `hardSkills` | |
| Compétences requises | `requiredSkills` | |
| Mots-clés | `keywords` | |
| Analyse de l'offre | `JobAnalysis` | |
| Profil recherché | `candidateProfile` | rubrique de l'annonce |
| Prérequis | `requirements` | |
| Couverture (exigences ↔ profil) | `coverage` | |
| Attestées / manquantes | `evidenced` / `missing` | |
| Demandées | `requested` | |
| Écartés | `excluded` | |
| Pertinence / niveau | `relevance` / `RelevanceLevel` | |
| Garde-fou | `guard` | |
| Assainissement | `sanitization` | |
| Invention (du LLM) | `fabrication` | `motsNonAttestes` → `unsupportedWords` |
| Contrat (CDI…) | `contractType` | |
| Fournisseur LLM | `LlmProvider` | |
| Moteur LLM | `LlmEngine` | |
| Modèle de langage embarqué | `LocalModel` | **jamais** « model » seul pour éviter la confusion ci-dessous |
| Modèle de CV / mise en page | `CvTemplate` | ex-`ModeleCv`, `IdModele` → `TemplateId` |
| Réglages / paramètres | `Settings` | |
| Clé API | `apiKey` | |
| Mise à jour | `Update` (`UpdateState`) | |
| Téléchargement | `download` | |
| Progression | `progress` | |
| Tâche / étape | `task` / `step` | `CleEtape` → `StepKey` |
| Vue / écran | `View` / `Screen` | |
| Parcours | `flow` | |
| Erreur codée | `CodedError` | |
| Récupération (offre) | `fetch` | |
| Rendu (navigateur) | `render` | |
| Extraction | `extraction` | |

## 2. Champs des schémas Zod (données persistées : migration obligatoire)

| Schéma | Avant → Après |
|---|---|
| `profilSchema` → `profileSchema` | `nom`→`fullName`, `email`, `telephone`→`phone`, `adresse`→`location`, `liensProfessionnels`→`links`, `titrePoste`→`headline`, `accroche`→`summary`, `experiences`, `competences`→`skills`, `formations`→`education`, `langues`→`languages`, `photo` |
| `experienceSchema` | `poste`→`position`, `entreprise`→`company`, `lieu`→`location`, `periode`→`dateRange`, `description`, `realisations`→`achievements` |
| `formationSchema` → `educationSchema` | `diplome`→`degree`, `etablissement`→`school`, `lieu`→`location`, `periode`→`dateRange`, `description` |
| `langueSchema` → `languageSchema` | `nom`→`name`, `niveau`→`level` |
| `offreSchema` → `jobPostingSchema` | `titrePoste`→`jobTitle`, `entreprise`→`company`, `lieu`→`location`, `texteBrut`→`rawText` |
| `cvAdapteSchema` → `tailoredCvSchema` | `titre`→`headline`, `accroche`→`summary`, `experiences`, `competencesCles`→`keySkills`, `competences`→`skills`, `formations`→`education`, `langues`→`languages`, `ecartes`→`excluded`, `demandees`→`requested` |
| `experienceAdapteeSchema` → `tailoredExperienceSchema` | `indice`→`sourceIndex`, `points`→`bullets` (+ champs d'`experienceSchema`) |
| `demandeesSchema` → `requestedSchema` | `attestees`→`evidenced`, `manquantes`→`missing`, `prerequis`→`requirements` |
| `prerequisSchema` → `requirementsSchema` | `formation`→`education`, `experience` ; `exigee`→`required`, `statut`→`status` (`ok`, `insuffisante`→`insufficient`, `inconnue`→`unknown`, `retrouvee`→`found`, `non-retrouvee`→`not-found`), `profil`→`profileValue` |
| `parametresSchema` → `settingsSchema` | `fournisseur`→`provider` (`local`, `ollama`, `api`), `modeleOllama`→`ollamaModel`, `urlOllama`→`ollamaUrl`, `urlApi`→`apiUrl`, `modeleApi`→`apiModel`, `reformulerPuces`→`rewriteBullets`, `modeleCv`→`cvTemplate`, `cheminModeleLocal`→`localModelPath` |
| Identifiants de modèles de CV | `classique`→`classic`, `moderne`→`modern`, `elegant`, `bandeau`→`banner`, `lateral`→`sidebar`, `pastel` |
| Codes d'erreur | `annule`→`cancelled`, `fichier-illisible`→`unreadable-file`, `moteur-absent`→`engine-missing`, `ecriture-impossible`→`write-failed`, `profil-absent`→`profile-missing`, `url-invalide`→`invalid-url`, `reseau`→`network`, `http`, `contenu-non-html`→`not-html`, `contenu-vide`→`empty-content`, `site-protege`→`protected-site` |

## 3. Stockage

| Avant | Après |
|---|---|
| Table `profils` (`donnees`, `mis_a_jour`) | `profiles` (`data`, `updated_at`) |
| Table `offres` (`url`, `donnees`, `cree_le`) | `job_postings` (`url`, `data`, `created_at`) |
| Table `cv_generes` (`profil_id`, `offre_id`, `donnees`, `cree_le`) | `tailored_cvs` (`profile_id`, `job_posting_id`, `data`, `created_at`) |
| `userData/recv.db` | inchangé |
| `userData/parametres.json` | `settings.json` (+ champ `version`) |
| `userData/cle-api.bin` | `api-key.bin` |
| `userData/modeles/` | `models/` (déplacer les `.gguf` existants, ou lire l'ancien dossier) |
| `localStorage` `recv.nomFichierCv` / `recv.dureeCreation` | `recv.cvFileName` / `recv.tailoringDuration` |

## 4. Canaux IPC (`CANAUX` → `CHANNELS`)

`cv:importer`→`cv:import`, `cv:importer-depose`→`cv:import-dropped`, `profil:obtenir`→`profile:get`,
`profil:enregistrer`→`profile:save`, `profil:generer-accroche`→`profile:generate-summary`,
`offre:recuperer`→`job:fetch`, `offre:analyser-texte`→`job:parse-text`, `offre:analyser-annonce`→`job:analyze`,
`cv:adapter`→`cv:tailor`, `cv:annuler-adaptation`→`cv:cancel-tailoring`, `cv:exporter`→`cv:export`,
`cv:html-modele`→`cv:template-html`, `fichier:ouvrir`→`file:open`, `fichier:montrer`→`file:reveal`,
`parametres:lire`→`settings:get`, `parametres:enregistrer`→`settings:save`, `parametres:definir-cle`→`settings:set-api-key`,
`modeles:etat`→`models:get-state`, `modeles:telecharger`→`models:download`, `modeles:annuler`→`models:cancel`,
`modeles:supprimer`→`models:delete`, `modeles:progression`→`models:progress`, `taches:progression`→`tasks:progress`,
`donnees:effacer`→`data:erase`, `mise-a-jour:etat`→`update:get-state`, `mise-a-jour:verifier`→`update:check`,
`mise-a-jour:installer`→`update:install`, `mise-a-jour:changement`→`update:changed`.
Méthodes de l'API : même logique (`importerCv`→`importCv`, `adapterCv`→`tailorCv`, `surProgressionTache`→`onTaskProgress`…).
`window.api` reste `window.api` ; `ApiReCV` → `RecvApi`.

## 5. Fichiers et dossiers

| Avant | Après |
|---|---|
| `src/core/canaux.ts`, `erreurs.ts`, `etapes.ts` | `channels.ts`, `errors.ts`, `steps.ts` |
| `src/core/schemas/profil.ts`, `offre.ts`, `cvAdapte.ts`, `liens.ts` | `profile.ts`, `jobPosting.ts`, `tailoredCv.ts`, `links.ts` |
| `src/core/parsing/` | inchangé |
| `src/core/offre/` (`recuperation`, `extraction`, `donneesStructurees`, `sections`, `texte`, `contrat`) | `src/core/job-posting/` (`fetch`, `extraction`, `structuredData`, `sections`, `text`, `contractType`) |
| `src/core/llm/` (`fournisseur`, `fournisseurs`, `fournisseurStructure`, `fournisseurMock`, `moteur`, `moteurAiSdk`, `moteurLocal`, `moteurMock`, `modelesEmbarques`, `assainissement`, `extraction`, `prompts`) | `src/core/llm/` (`provider`, `providers`, `structuredProvider`, `mockProvider`, `engine`, `aiSdkEngine`, `localEngine`, `mockEngine`, `localModels`, `sanitization`, `extraction`, `prompts/fr.ts`) |
| `src/core/adaptation/` (`pipeline`, `motsCles`, `pertinence`, `reecriture`, `couverture`, `competences`, `composition`, `titreAccroche`, `accrocheProfil`, `vocabulaire`, `texte`) | `src/core/tailoring/` (`pipeline`, `jobAnalysis`, `relevance`, `rewriting`, `coverage`, `skills`, `composition`, `summary`, `profileSummary`, `vocabulary`, `text`) |
| `src/core/export/` (`CvHtml.tsx`, `docx.ts`, `modele.ts`, `modeles.ts`) | `src/core/export/` (`CvHtml.tsx`, `docx.ts`, `cvDocument.ts`, `templates.ts`) |
| `src/main/bdd/` (`connexion`, `depots`, `schema`) | `src/main/db/` (`connection`, `repositories`, `schema`, `migrations/`) |
| `src/main/` `cv.ts`, `lectureCv.ts`, `miseAJour.ts`, `parametres.ts`, `service.ts`, `durcissement.test.ts` | `cvPicker.ts`, `readCv.ts`, `updater.ts`, `settingsStore.ts`, `service.ts`, `hardening.test.ts` |
| `src/main/modeles/` (`gestionnaire`, `telechargement`, `ressources`) | `src/main/models/` (`manager`, `download`, `resources`) |
| `src/main/offre/rendu.ts` | `src/main/job-posting/render.ts` |
| `src/renderer/src/ecrans/` | `src/renderer/src/screens/` |
| `Accueil`, `Preparation`, `MonCv`, `Annonce`, `Creation`, `NouveauCv`, `CeQuiAChange`, `GalerieModeles`, `Succes`, `Reglages`, `MisesAJour` | `Welcome`, `Setup`, `MyCv`, `JobPosting`, `Generating`, `NewCv`, `WhatChanged`, `TemplateGallery`, `Success`, `Settings`, `Updates` |
| `src/renderer/src/ui/` `Alerte`, `AlerteErreur`, `Bouton`, `Champ`, `Etapes`, `IllustrationCv`, `ZoneDepot`, `icones`, `structure` | `Alert`, `ErrorAlert`, `Button`, `TextField` (+ `Select`, `Checkbox`), `Stepper`, `CvIllustration`, `DropZone`, `icons`, (éclaté, voir ARCH-04) |
| `src/renderer/src/` `parcours.ts`, `erreurs.ts`, `estimation.ts`, `progression.ts`, `photo.ts` | `flow.ts`, `errors.ts`, `estimate.ts`, `progress.ts`, `photo.ts` |
| `scripts/essai.ts` (`npm run essai`) | `scripts/try-pipeline.ts` (`npm run try`) |

## 6. Ce qui ne change pas

- Nom affiché `Re:CV`, identifiant `recv`, `appId` `org.recv.app`, exécutable `ReCV.exe`, `productName` `ReCV`.
- Textes affichés, en français (vouvoiement).
- Contenu des prompts (en français, voir I18N-02) ; seuls les noms de champs JSON qu'ils citent changent.
- Titres de sections du CV produit (« Expérience professionnelle »…) : ce sont des textes, pas du code.
