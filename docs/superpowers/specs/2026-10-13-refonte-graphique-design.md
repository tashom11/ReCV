# Refonte graphique de Re:CV — spec de conception

Date : 13 octobre 2026
Référence visuelle : `Re CV — refonte.pdf` (15 pages : cartographie, maquettes, états, design system, micro-textes).
Brief d'origine : `docs/prompt-refonte-graphique.md`.

## 1. But

Remplacer l'interface à quatre onglets (Profil · Offre · Vérification · Paramètres) par un assistant en trois
étapes — ① Mon CV → ② L'annonce → ③ Mon nouveau CV — qu'une personne peu à l'aise avec l'informatique parcourt
seule, sans rencontrer de mot technique hors des « Options avancées ».

Règle de conduite : **en cas de doute, la maquette fait foi** (mise en page, libellés, ordre des éléments, couleurs,
tailles). Les écarts assumés sont listés en section 8.

## 2. Décisions prises

| Sujet | Décision |
|---|---|
| Périmètre | Renderer réécrit, plus des ajouts IPC ciblés dans `core/api.ts`, `main` et `preload`. |
| Retour dans l'application | L'accueil ne s'affiche que s'il n'y a aucun CV enregistré ; sinon on arrive à l'étape ②. |
| Pastilles de l'étape ② | L'analyse de l'annonce par le modèle est lancée dès « Lire l'annonce ». |
| Découpage | Une spec, un plan en trois phases, l'application utilisable à la fin de chacune. |
| Fidélité | Priorité à la maquette. |

## 3. Système de design (« Atelier chaleureux »)

### Tokens — `src/renderer/src/index.css`, bloc `@theme` Tailwind v4

- Polices : `--font-sans` Atkinson Hyperlegible (400, 700), `--font-titre` Bricolage Grotesque Variable ; repli
  Segoe UI. Embarquées via `@fontsource/atkinson-hyperlegible` et `@fontsource-variable/bricolage-grotesque`
  (**deux nouvelles dépendances**, licence OFL, aucune requête réseau).
- Couleurs : encre `#1E2622`, encre-douce `#3B443E`, aide `#4A534D`, papier `#F7F4EC`, surface `#FFFFFF`,
  trait `#DED8CA`, trait-fort `#8C8778`, marque `#23624A`, marque-survol `#1B4F3B`, marque-pale `#E6F0EA`,
  accent `#C9E265`, accent-pale `#F1F8D6`, erreur `#A12A1E` sur `#FCE9E6`, alerte `#7A4B00` sur `#FDF1D6`,
  info `#1F4E79` sur `#E7F0F8`, succès `#23624A` sur `#E8F3E4`.
- Échelle de texte : titre-accueil 52/1.05, titre-ecran 36/1.15, titre-section 24/1.25, intro 18/1.5,
  corps 16/1.5, aide 14/1.45. Jamais moins de 14 px, sauf l'aperçu du CV.
- Rayons : champ 10, bouton 12, carte 16, panneau 20, pastille (pleine). Ombres : carte, panneau, barre.
- Mouvement : `--duree-rapide` 150 ms, `--duree` 250 ms, `--courbe` `cubic-bezier(.2,.7,.2,1)`. Une seule
  animation de plaisir : la coche de l'écran de succès. Tout s'arrête avec `prefers-reduced-motion`.
- Focus : contour encre 3 px décalé de 3 px sur tout élément focusable.

### Composants — `src/renderer/src/ui/` (un fichier par composant, `index.ts` réexporte)

Conservés avec leurs props, redessinés : `Bouton` (principal, secondaire, danger, `enCours`, désactivé en bordure
pointillée ; hauteur 48, option `taille="grand"` 52–60 pour l'action de l'écran ; icône facultative), `Champ`
(libellé 15 gras au-dessus, aide 14 dessous, erreur = bordure 2 px + icône + texte, `action` intégrée),
`Selection`, `Alerte` (icône + titre + texte + actions ; `role="alert"` pour l'erreur), `Carte`, `Titre`,
`Spinner`, `messageErreur`. `Chargement` reste pour les attentes courtes dans un écran.

Nouveaux :

| Composant | Props principales | Notes |
|---|---|---|
| `Etapes` | `courante`, `faites`, `onAller(etape)`, `libelleCourante?` | `<nav aria-label="Étapes"><ol>`, `aria-current="step"`, état écrit (faite / en cours / à venir) ; une étape faite est cliquable. |
| `ZoneDepot` | `onFichier(file)`, `onChoisir()`, `occupe` | Bordure pointillée ; état « Lâchez le fichier ici » ; le bouton reste le chemin clavier. |
| `Pastille` | `variante` (demandee, presente, recommande, neutre) | Icône + mot, jamais la couleur seule. |
| `SectionRepliable` | `titre`, `compte?`, `resume`, `ouverte?` | `<details>/<summary>` natifs. |
| `OngletsSegmentes` | `onglets`, `valeur`, `onChange` | `role="tablist"`, flèches gauche/droite. |
| `VignetteModele` | `nom`, `choisi`, `onChoisir`, `children` (aperçu) | `aria-pressed`, coche + mot « Choisi ». |
| `EtatVide` | `titre`, `texte`, `action` | |
| `BarreActions` | `gauche`, `children` | Collée en bas (`sticky`), fond encre. |
| `CaseACocher` | `etiquette`, `coche`, `onChange` | Case 22 px, toute la ligne cliquable. |
| `icones.tsx` | — | SVG inline, `aria-hidden`. |

Le logo passe à 40 px dans l'en-tête.

## 4. Parcours et navigation

### Vues

`accueil` · `preparation` · `cv` · `annonce` · `creation` · `resultat` · `succes` · `reglages`.

L'en-tête porte le logo, `Etapes` (masqué sur `accueil`, `preparation`, `reglages`) et le bouton « Réglages »
(masqué pendant `preparation`, `creation`, `succes`, conformément aux maquettes). Dans `reglages`, il est remplacé
par « ← Revenir où j'en étais ».

### Règles — `src/renderer/src/parcours.ts` (pur, testé)

- `vueInitiale({ profilPresent })` : `accueil` sans profil, sinon `annonce`.
- « Commencer » : `preparation` si le moteur n'est pas prêt, sinon `cv`.
- Moteur prêt : fournisseur `ollama` ou `api`, ou fournisseur `local` avec un chemin de modèle ou un modèle installé.
- `preparation` → « Plus tard » mène à `cv` ; l'alerte « Re:CV n'est pas encore tout à fait prêt » s'affiche alors
  à toute étape qui a besoin du moteur, avec l'action « Terminer la préparation ».
- Étapes faites : ① dès qu'un profil est enregistré ; ② dès qu'une annonce est confirmée ; ③ après un export.
- `Etapes.onAller` : ① → `cv`, ② → `annonce`, ③ → `resultat` (si un CV a été créé, sinon état vide).
- « Adapter pour une autre offre » : retour à `annonce`, annonce et résultat remis à zéro, profil gardé.
- Après « Tout effacer » : retour à `accueil`.

### Écrans

| Vue | Fichier | Origine | Contenu (page de la maquette) |
|---|---|---|---|
| accueil | `ecrans/Accueil.tsx` | nouveau | Bandeau « Gratuit · sans compte · sur votre ordinateur », titre 52, « Commencer », trois garanties, illustration (p. 2). |
| preparation | `ecrans/Preparation.tsx` | nouveau | Carte « On prépare Re:CV », pourcentage, Go reçus, temps restant, « Plus tard », lien vers les réglages (p. 3). Télécharge le modèle recommandé. |
| cv | `ecrans/MonCv.tsx` | `Profil.tsx` | Sans profil : `ZoneDepot` (p. 4). Avec profil : bandeau sombre « Votre CV est lu » + six sections repliables + barre « Ça me va, continuer » (p. 5). |
| annonce | `ecrans/Annonce.tsx` | `Offre.tsx` | Onglets « Coller un lien » / « Coller le texte » (p. 6), puis carte de confirmation avec pastilles, « Bon à savoir », texte complet replié (p. 7). |
| creation | `ecrans/Creation.tsx` | nouveau | Quatre étapes nommées, barre, temps écoulé et restant, « Annuler » (p. 8). |
| resultat | `ecrans/NouveauCv.tsx` | `Diff.tsx` | Panneau d'ajustements à gauche, vignettes + grand aperçu à droite, `BarreActions` (p. 9). |
| — | `ecrans/CeQuiAChange.tsx` | `Diff.tsx` | Comparatif avant / après, ouvert par « Voir ce qui a changé » ; édition des phrases d'expérience et cases « Garder ». |
| succes | `ecrans/Succes.tsx` | nouveau | Coche animée, fichier, « Ouvrir le dossier », « Ouvrir le CV », « Adapter pour une autre offre » (p. 10). |
| reglages | `ecrans/Reglages.tsx` | `Parametres.tsx` + `GestionModeles.tsx` | Moteur recommandé, Rapide / Équilibré / Soigné, « Options avancées » repliées, « Mes données » avec confirmation en ligne (p. 11–12). |

`GalerieModeles.tsx` devient une bande de `VignetteModele` et un grand aperçu du modèle choisi, régénérés
automatiquement 400 ms après la dernière modification.

### Étape ③ — détail

- Panneau gauche : « Titre et présentation » (titre, phrase de présentation), « Compétences mises en avant »
  (« Déjà dans votre CV · placées en premier », puis encadré « Demandées par l'annonce, absentes de votre CV » avec
  cases **décochées par défaut**), « Retiré de ce CV (n) » replié, bouton « Voir ce qui a changé ».
- Barre : « Mise en page « Classique » · 1 page » à gauche ; « Version Word (.docx) » et « Télécharger en PDF » à
  droite. Aucun bouton « Valider » : le téléchargement vaut validation.
- Pas de score de correspondance.

## 5. Ajouts hors renderer

### Contrat — `src/core/api.ts`, `src/core/canaux.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, `src/main/service.ts`

| Méthode | Signature | Comportement |
|---|---|---|
| `importerCvDepose` | `(fichier: File) => Promise<ProfilEnregistre>` côté renderer ; le preload résout le chemin avec `webUtils.getPathForFile` et envoie une chaîne | Main revalide extension (`.pdf`, `.docx`) et taille (20 Mo), puis suit le même chemin que `importerCv`. `main/cv.ts` expose `lireCv(chemin)`. |
| `analyserAnnonce` | `(offre: Offre) => Promise<ApercuAnnonce>` | Analyse l'offre avec le modèle (mémorisée sous la même clé que `adapterCv`), puis calcule la couverture face au profil actif. |
| `annulerAdaptation` | `() => Promise<void>` | Interrompt l'adaptation en cours ; `adapterCv` rejette avec le code `annule`. |
| `ouvrirFichier` | `(chemin: string) => Promise<void>` | `shell.openPath`. |
| `montrerDansDossier` | `(chemin: string) => Promise<void>` | `shell.showItemInFolder`. |

`ApercuAnnonce` : `{ recherchees: string[] (8 au plus), contrat?: string, prerequis: PrerequisOffre }`.
`contrat` est repéré par expression régulière dans le texte de l'annonce (CDI, CDD, intérim, alternance, stage ;
temps plein / partiel) : rien n'est demandé au modèle, rien n'est inventé.

Sécurité : `ouvrirFichier` et `montrerDansDossier` n'acceptent que les chemins écrits par `exporterCv` pendant la
session (ensemble tenu par le service). Tout autre chemin est refusé.

Les erreurs IPC portent un `code` pour tous les cas que l'interface distingue : codes d'offre existants, plus
`annule`, `fichier-illisible`, `moteur-absent`, `ecriture-impossible`.

### Annulation — `src/core/llm/`, `src/core/adaptation/pipeline.ts`

`OptionsAdaptation` et `RequeteObjet` gagnent un `signal?: AbortSignal`. Le pipeline le vérifie entre les étapes
et le transmet à chaque `genererObjet` ; `moteurAiSdk` le passe en `abortSignal`, `moteurLocal` à la session
`node-llama-cpp`. `moteurMock` le respecte pour les tests.

### Étapes nommées

`EtapeAdaptation` et `ProgressionTache` gagnent `cle?: 'preparation' | 'analyse' | 'selection' | 'reformulation' | 'accroche'`.
Correspondance d'affichage : `analyse` → « Je lis l'annonce » ; `selection` et `reformulation` → « Je choisis ce
qui vous met en valeur » ; `accroche` → « J'écris votre phrase de présentation » ; génération de l'aperçu, côté
renderer → « Je mets votre CV en page ».

### Durées — `src/renderer/src/estimation.ts` (pur, testé)

- Création : estimation = durée de la création précédente (gardée dans `localStorage`), 120 s par défaut.
  Restant = estimation − écoulé, arrondi à la minute, jamais sous « moins d'une minute ». Après 5 minutes :
  alerte « C'est plus long que prévu, mais ça avance ».
- Téléchargement : débit moyen glissant → « environ N minutes restantes ».

### Comportement par défaut

`choixInitial` (`core/adaptation/composition.ts`) : `ajouterDemandees` à `false` partout.

## 6. Erreurs et états

`src/renderer/src/erreurs.ts` (pur, testé) : `decrireErreur(contexte, erreur)` → `{ type, titre, texte, actions, details }`.

| Contexte / code | Titre | Action principale |
|---|---|---|
| annonce · `site-protege`, `http`, `contenu-vide`, `contenu-non-html` | Ce site ne nous laisse pas lire l'annonce | Coller le texte à la place |
| annonce · `reseau` | Pas de connexion internet (info) | Coller le texte · Réessayer |
| cv · `fichier-illisible` | Nous n'arrivons pas à lire ce fichier | Choisir un autre fichier |
| toute étape · `moteur-absent` | Re:CV n'est pas encore tout à fait prêt (avertissement) | Terminer la préparation |
| création · autre | La création s'est arrêtée en route | Réessayer · Détails |
| export · `ecriture-impossible` | Impossible d'enregistrer le CV ici | Choisir un autre dossier · Réessayer |
| préparation · interruption | Le téléchargement s'est interrompu | Reprendre |

Le message technique n'apparaît que dans « Détails », replié. Le focus va sur le titre de l'erreur.
Confirmation brève (« Vos corrections sont enregistrées. ») : `role="status"`, disparaît après 5 s.
État vide de l'étape ③ : « Votre nouveau CV apparaîtra ici ».

## 7. Micro-textes et accessibilité

- Vouvoiement partout, y compris dans les messages d'erreur de `main` et `core`.
- Les 30 remplacements de la page 15 sont appliqués tels quels.
- Accessibilité : les dix points de la page 15 (tailles, cibles 44 px, focus, `nav`/`ol`, `role="status"`,
  `role="alert"`, onglets, `details`, `fieldset`/`legend`, couleur jamais seule).

## 8. Écarts assumés par rapport à la maquette

- Réglages : un champ « Modèle » est ajouté sous « Service » (obligatoire pour appeler un service en ligne) ;
  « Service » propose OpenAI, Mistral, OpenRouter et « Autre adresse » (champ d'adresse affiché dans ce cas).
- « Enregistré sur votre Bureau » : le sélecteur d'enregistrement est conservé ; l'écran de succès nomme le
  dossier réellement choisi.
- L'édition des phrases d'expérience n'est pas dans le panneau de l'étape ③ : elle vit dans « Voir ce qui a changé ».

## 9. Tests

- Vitest, fonctions pures : `parcours`, `erreurs`, `estimation`, extraction du contrat.
- Service (`main.test.ts`, `durcissement.test.ts`) avec `FournisseurMock` : `analyserAnnonce` (mémorisation
  partagée avec `adapterCv`), `annulerAdaptation`, `importerCvDepose` (extension et taille refusées),
  `ouvrirFichier` / `montrerDansDossier` (chemin non exporté refusé).
- Pipeline : annulation entre deux étapes ; `choixInitial` décoché.
- Aucune dépendance de test ajoutée. Les écrans se vérifient avec `npm run dev` à la fin de chaque phase.

## 10. Phases

1. **Fondations** — dépendances de polices, tokens, dossier `ui/`, en-tête avec `Etapes`, vouvoiement. Les écrans
   actuels tournent avec le nouvel habillage.
2. **Parcours** — ajouts hors renderer (section 5), puis `MonCv`, `Annonce`, `Creation`, `NouveauCv`,
   `CeQuiAChange`, `Succes`.
3. **Autour** — `Accueil`, `Preparation`, `Reglages`, `erreurs.ts` branché partout, état vide, nettoyage des
   anciens fichiers.

## 11. Hors périmètre

Modèles de CV exportés, logique d'adaptation (hors points de la section 5), thème sombre, tests de rendu React.
