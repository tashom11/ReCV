# Prompt — refonte graphique de Re:CV (à coller dans Claude Design)

> Joindre en pièces jointes : `src/renderer/src/ui.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/ecrans/*.tsx`,
> `src/renderer/src/index.css`, `src/renderer/src/assets/logo.png`, et 3–4 captures d'écran de l'application actuelle
> (Profil, Offre, Vérification, Paramètres).

---

## 1. Mission

Tu es directeur artistique et designer produit. Refonds l'interface de **Re:CV**, une application de bureau Windows
gratuite et open source qui **adapte un CV à une offre d'emploi** : l'utilisateur importe son CV (PDF/DOCX), colle un
lien ou le texte d'une annonce, et obtient un CV adapté, exportable en PDF ou DOCX.

**Objectif : qu'une personne qui n'est pas à l'aise avec l'informatique puisse, seule, obtenir un CV adapté en moins
de 5 minutes d'attention, sans jamais rencontrer un mot technique.** Le moteur de l'application (extraction, adaptation,
export) ne change pas : tu ne refais que l'expérience et le visuel.

## 2. Public cible

« Monsieur et Madame Tout-le-monde » : demandeurs d'emploi, salariés en reconversion, 25–65 ans, peu de culture
technique, parfois stressés par la recherche d'emploi, parfois sur un petit écran portable.

- Ils ne savent pas ce qu'est un « modèle de langage », un « fournisseur », une « API », Ollama, un GGUF ou un « profil
  structuré ».
- Ils lisent à l'écran avec effort : texte **assez grand** (corps ≥ 16 px, aides ≥ 14 px, jamais de 12 px), contrastes
  forts (WCAG AA minimum), zones cliquables larges (≥ 44 px de haut).
- Ils veulent être guidés, rassurés (« rien n'est envoyé nulle part », « vous pouvez tout modifier ») et savoir **où ils en
  sont** et **ce qui reste à faire**.
- Ils ont peur de « casser » quelque chose : toute action importante est réversible ou confirmée.

## 3. Contraintes techniques (non négociables)

- Application **Electron** (Windows), interface en **React 19 + TypeScript + Tailwind CSS v4**, aucune librairie UI
  lourde ajoutée. Une petite police et des icônes SVG inline suffisent ; toute nouvelle dépendance doit être signalée.
- **Fenêtre** : minimum 900 × 640, doit rester agréable de 1024 à 1920 px de large. Pas de version mobile.
- **Hors ligne** : aucune ressource distante au chargement (polices embarquées ou polices système).
- Textes **en français**, code et noms de composants en français (convention du projet).
- **Accessibilité** : navigation clavier complète, focus visible, `aria-live` sur les chargements, ne pas coder
  l'information par la couleur seule, respecter `prefers-reduced-motion` et le thème clair (le thème sombre est un
  bonus facultatif).
- Garder les **props et la logique** des écrans existants (appels `window.api.*`, états de chargement/erreur). Tu
  livres des composants et du balisage, pas de nouvelle logique métier.
- Les **modèles de CV exportés** (Classique, Moderne, Élégant, Bandeau, Latéral, Pastel) sont hors périmètre : ils sont
  conçus pour les logiciels de recrutement (ATS). Seule la galerie qui les présente fait partie de la refonte.

## 4. Diagnostic de l'interface actuelle (ce qu'il faut corriger)

**Structure et navigation**
1. Quatre onglets plats — *Profil · Offre · Vérification · Paramètres* — sans notion d'**étapes** ni de progression.
   « Vérification » est grisé sans explication tant qu'aucun CV n'a été généré. Le parcours réel est linéaire :
   *mon CV → l'offre → vérifier → exporter*.
2. Vocabulaire interne exposé : « Profil », « Offre », « Vérification », « diff », « attestées », « couverture »,
   « Fournisseur », « modèle embarqué », « clé API », « mémoire graphique », « Hugging Face ».
3. **Premier lancement hostile** : une alerte jaune « Aucun modèle de langage n'est installé. Télécharger un modèle (ou
   configurer Ollama / une API dans les paramètres) » renvoie vers un écran technique. Un novice ne sait pas quoi faire.
4. Les **Paramètres** (choix du moteur IA, clé API, téléchargement de modèles de plusieurs Go) sont au même niveau que
   les étapes principales alors qu'ils ne concernent qu'une minorité d'utilisateurs.

**Écrans**
5. *Profil* : un très long formulaire de cartes empilées (Photo, Identité, Accroche, Expériences, Compétences,
   Formations, Langues) où chaque champ est visible d'un coup. Beaucoup de champs de saisie pour quelqu'un qui vient
   « juste » d'importer son CV ; deux boutons d'enregistrement (« Enregistrer » / « Enregistrer et continuer »)
   ambigus.
6. *Offre* : deux boutons (« Depuis un lien » / « Coller le texte ») ressemblent à des actions et non à un choix
   d'onglet ; l'offre détectée s'affiche avec un énorme champ de texte brut éditable, peu lisible.
7. *Vérification* : une page interminable (Titre, Accroche, chaque expérience, Compétences, Compétences demandées,
   Formations, Écarté, Modèle de CV, Exporter) en deux colonnes « avant / après ». **Le bouton d'export est tout en
   bas** : l'objectif de toute l'application est le moins visible. Les cases à cocher « compétences demandées »
   (attestées / à cocher) demandent de comprendre le principe de l'adaptation.
8. *Galerie de modèles* : bonne idée (vrais aperçus), mais intégrée au bas d'une page déjà saturée.
9. *Chargements* : le bloc de progression (étape, temps écoulé, barre) est bien, à conserver ; mais l'adaptation peut
   durer plusieurs minutes et l'écran ne donne pas envie d'attendre.

**Visuel**
10. Look « Tailwind par défaut » : gris ardoise + indigo, cartes blanches uniformes, textes en `text-xs`/`text-sm`
    (12–14 px) partout, hiérarchie plate, aucune illustration, aucune icône, pas d'état « vide » soigné, logo de 28 px
    seulement. Aucune personnalité, aucun moment de réconfort ou de satisfaction.
11. Messages d'erreur bruts (ex. site d'offre qui bloque, modèle introuvable) : informatifs mais sans ton humain ni
    action claire (« Que faire maintenant ? »).

## 5. Parcours cible à concevoir

Un **assistant en 3 étapes** toujours visible en haut (stepper cliquable vers les étapes déjà faites) :

**① Mon CV → ② L'annonce → ③ Mon nouveau CV**

- **Accueil / premier lancement** : écran de bienvenue (logo, promesse en une phrase, un seul gros bouton
  « Commencer »). Vérification invisible du moteur d'IA : si rien n'est prêt, un écran *« Préparation de
  l'application »* explique en une phrase pourquoi un téléchargement est nécessaire (taille, durée estimée, « une seule
  fois », fonctionne ensuite sans internet) avec une barre de progression et un bouton « Plus tard ». Aucun
  vocabulaire technique ; le détail reste dans les réglages avancés.
- **① Mon CV** : grande zone de dépôt (« Glissez votre CV ici ou cliquez pour le choisir ») PDF/DOCX. Après analyse,
  afficher **un résumé lisible de ce qui a été compris** (nom, métier, nombre d'expériences, de formations…) puis une
  vérification **par sections repliables** (Identité, Expériences, Compétences, Formations, Langues, Photo
  facultative) plutôt qu'un formulaire géant. Un seul bouton principal : « Ça me va, continuer ».
- **② L'annonce** : onglets segmentés clairs *Coller un lien* / *Coller le texte*. Après récupération, une **carte de
  confirmation** : intitulé du poste, entreprise, lieu, et les 5–8 compétences/qualités repérées sous forme de
  pastilles ; le texte brut est derrière « Voir le texte complet ». Bouton principal : « Créer mon CV adapté ».
- **Chargement** : écran dédié, rassurant et animé avec étapes nommées en langage courant (« Je lis l'annonce »,
  « Je choisis ce qui vous met en valeur », « Je rédige votre accroche »), temps estimé, possibilité d'annuler.
- **③ Mon nouveau CV** : **aperçu du CV en grand à droite** (mis à jour en direct), et à gauche un panneau d'ajustements
  simples — titre, accroche, compétences à garder/ajouter (cases à cocher avec libellés humains), éléments écartés
  réintégrables. Choix du **modèle** par vignettes visuelles au-dessus de l'aperçu. **Bouton « Télécharger en PDF »
  toujours visible** (barre fixe), « Word (DOCX) » en action secondaire. Le comparatif « avant / après » devient
  une option (« Voir ce qui a changé »), pas le mode par défaut.
- **Après export** : écran de succès (confirmation, bouton « Ouvrir le dossier », « Adapter pour une autre offre »).
- **Réglages** (icône engrenage, hors du parcours) : « Moteur d'intelligence artificielle » en deux niveaux — une
  carte **« Recommandé : sur mon ordinateur, gratuit et privé »**, et une section **« Avancé »** repliée pour Ollama /
  API en ligne (avec avertissement clair sur la confidentialité) ; gestion des données (« Effacer mes données »,
  confirmation explicite).

## 6. Système de design attendu

Propose et livre :
- **Identité** : ton chaleureux, rassurant, « sérieux mais humain » (pas startup froide, pas administration). Une couleur
  de marque principale + une couleur d'accent + neutres chauds ; états succès/avertissement/erreur accessibles.
  Garder une cohérence avec le logo existant (fond sombre, « Re: » vert-jaune, « CV » blanc) en le faisant évoluer si
  nécessaire.
- **Typographie** : une famille lisible (libre de droits, embarquable), échelle définie (titre d'écran ≥ 28 px, titre de
  section ≥ 20 px, corps 16 px, aide 14 px).
- **Espacement / rayons / ombres / mouvements** : tokens nommés (CSS variables ou thème Tailwind v4 `@theme`).
- **Composants** (à redessiner en conservant leurs noms et props) : `Bouton` (principal, secondaire, danger, état
  chargement), `Champ` (texte, multiligne avec action intégrée), `Selection`, `Alerte` (erreur, info, avertissement,
  succès, avec icône et action suggérée), `Carte`, `Titre`, `Chargement`, `Spinner`, plus de nouveaux : `Etapes`
  (stepper), `ZoneDepot`, `Pastille`, `SectionRepliable`, `VignetteModele`, `EtatVide`, `BarreActions` fixe.
- **États** pour chaque écran : vide, chargement, succès, erreur (avec « que faire »), hors ligne, long traitement.
- **Micro-textes** : réécris tous les libellés, aides et messages d'erreur dans un français simple, **vouvoiement**
  (décision prise : l’interface actuelle tutoie, tous les textes passent au vouvoiement), phrases courtes, verbes d'action, zéro jargon. Fournis un tableau
  « avant → après » des 30 textes les plus importants.

## 7. Livrables

1. Une **cartographie du parcours** (écrans, transitions, cas d'erreur) en une page.
2. Les **maquettes haute fidélité** de chaque écran et de leurs états (accueil, préparation, ① CV avant/après analyse,
   ② annonce avant/après récupération, chargement, ③ résultat, succès, réglages, erreurs).
3. Le **design system** (tokens, composants, règles d'usage).
4. Le **code** : composants React + Tailwind v4 prêts à intégrer dans `src/renderer/src/`, écran par écran, avec les
   mêmes props qu'aujourd'hui, sans modifier `src/core`, `src/main` ni `src/preload`.
5. Une **liste des changements de vocabulaire** et des points d'attention d'accessibilité.

## 8. Critères d'acceptation

- Un testeur novice, sans aide, va de l'ouverture de l'application au PDF téléchargé sans poser de question.
- Aucun terme technique visible hors de la section « Avancé ».
- Le bouton de téléchargement est visible en permanence sur l'écran ③ ; l'étape en cours est toujours identifiable.
- Contrastes AA, corps de texte ≥ 16 px, parcours complet faisable au clavier.
- Les écrans tiennent sans défilement horizontal de 900 à 1920 px de large.
- Aucune dépendance lourde ajoutée ; build `electron-vite` inchangé.

## 9. Ce que tu ne dois pas faire

- Ne pas promettre de fonctions absentes (compte en ligne, synchronisation, partage, score « ATS » chiffré).
- Ne pas décorer à l'excès : les modèles de CV exportés doivent rester sobres et lisibles par les ATS ; l'application,
  elle, peut être plus expressive.
- Ne pas masquer les avertissements de confidentialité quand les données quittent l'ordinateur (mode API en ligne).
- Ne pas imposer de compte, de télémétrie ni de publicité.
