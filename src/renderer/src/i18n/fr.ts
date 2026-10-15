// Texts of the interface, in French (vouvoiement). Every visible text lives here: another language is a file of the
// same shape (`Texts`). Texts that depend on a number or a name are functions.

import type { TemplateId } from '@core/export/templates'

const minutes = (n: number) => `${n} minute${n > 1 ? 's' : ''}`

const notReady = {
  title: 'Re:CV n’est pas encore tout à fait prêt',
  text: 'Il manque un téléchargement unique. Ensuite, plus besoin d’internet.',
}

export const fr = {
  appName: 'Re:CV',

  /** Window titles, the first thing a screen reader says when the screen changes. */
  windowTitles: {
    welcome: '',
    setup: 'Préparation',
    cv: 'Étape 1 sur 3 : mon CV',
    posting: 'Étape 2 sur 3 : l’annonce',
    generating: 'Création de votre CV',
    result: 'Étape 3 sur 3 : mon nouveau CV',
    success: 'CV téléchargé',
    settings: 'Réglages',
  },
  windowTitle: (screen: string) => `${screen} — Re:CV`,

  header: {
    back: 'Revenir où j’en étais',
    settings: 'Réglages',
    /** Read by screen readers after « Réglages »: what the red badge stands for. */
    notifications: (count: number) => `(${count} mise${count > 1 ? 's' : ''} à jour prête${count > 1 ? 's' : ''})`,
  },

  stepper: {
    label: 'Étapes',
    names: { 1: 'Mon CV', 2: 'L’annonce', 3: 'Mon nouveau CV' },
    states: {
      current: 'en cours',
      preparing: 'en préparation',
      done: 'faite',
      upcoming: 'à venir',
      toDownload: 'à télécharger',
    },
    step: (number: number, state: string) => `Étape ${number} · ${state}`,
  },

  emptyStates: {
    notReady: { ...notReady, action: 'Terminer la préparation' },
    noCv: {
      title: 'Commençons par votre CV',
      text: 'Pour lire une annonce et y adapter votre CV, il nous faut d’abord votre CV actuel.',
      action: 'Importer mon CV',
    },
    noTailoredCv: {
      title: 'Votre nouveau CV apparaîtra ici',
      text: 'Pour le créer, il nous faut votre CV actuel et l’annonce qui vous intéresse.',
      toPosting: 'Indiquer une annonce',
      toCv: 'Commencer par mon CV',
    },
  },

  dropZone: {
    drop: 'Lâchez le fichier ici',
    drag: 'Glissez votre CV ici',
    or: 'ou',
    choose: 'Choisir mon CV sur l’ordinateur',
    formats: 'Fichier PDF ou Word (.docx)',
  },

  common: { details: 'Détails' },

  /** Every problem says what is happening and what to do: a short title, a sentence without jargon, an action. */
  errors: {
    actions: {
      'paste-text': 'Coller le texte à la place',
      retry: 'Réessayer',
      'choose-file': 'Choisir un autre fichier',
      'finish-setup': 'Terminer la préparation',
      'choose-folder': 'Choisir un autre dossier',
      dismiss: 'Reprendre',
    },
    /** Shorter label when the action is not the recommended one. */
    secondaryActions: { 'paste-text': 'Coller le texte' } as Record<string, string>,
    engineMissing: notReady,
    posting: {
      network: {
        title: 'Pas de connexion internet',
        text: 'Pour lire un lien, il faut internet. En collant le texte de l’annonce, tout fonctionne sans connexion.',
      },
      invalidUrl: {
        title: 'Cette adresse n’est pas complète',
        text: 'Une adresse d’annonce commence par https://. Copiez-la depuis la barre d’adresse de votre navigateur.',
      },
      localNetwork: {
        title: 'Cette adresse n’est pas celle d’une annonce',
        text: 'Elle mène à un appareil de votre ordinateur ou de votre réseau (box, imprimante…). Copiez l’adresse de l’annonce depuis votre navigateur, ou collez son texte.',
      },
      blockedSite: {
        title: 'Ce site ne nous laisse pas lire l’annonce',
        text: 'Ça arrive souvent, ce n’est pas grave. Copiez le texte de l’annonce sur la page, puis collez-le ici.',
      },
      interrupted: {
        title: 'La lecture de l’annonce s’est arrêtée en route',
        text: 'Rien n’est perdu : vous pouvez relancer tout de suite.',
      },
    },
    cv: {
      unreadable: {
        title: 'Nous n’arrivons pas à lire ce fichier',
        text: 'C’est souvent le cas d’un CV scanné ou pris en photo. Essayez la version Word, ou un PDF enregistré depuis Word.',
      },
      emptyExtraction: {
        title: 'Le modèle n’a rien repéré dans votre CV',
        text: 'Votre fichier est lisible, mais le modèle choisi est trop petit pour en tirer vos expériences et compétences. Dans les Réglages, choisissez le niveau « Soigné » (plus lent, mais plus fiable), puis relancez.',
      },
      interrupted: {
        title: 'La lecture de votre CV s’est arrêtée en route',
        text: 'Votre fichier n’a pas été modifié. Vous pouvez relancer tout de suite.',
      },
    },
    export: {
      title: 'Impossible d’enregistrer le CV ici',
      text: 'Le fichier est peut-être déjà ouvert, ou le dossier est protégé. Fermez le PDF s’il est ouvert, ou choisissez un autre dossier.',
    },
    setup: {
      title: 'Le téléchargement s’est interrompu',
      text: 'Ce qui est déjà téléchargé est gardé : il repartira là où il s’était arrêté.',
    },
    settings: {
      title: 'Ce réglage n’a pas pu être enregistré',
      text: 'Vérifiez ce que vous avez saisi, puis réessayez.',
    },
    generating: {
      title: 'La création s’est arrêtée en route',
      text: 'Rien n’est perdu : votre CV et l’annonce sont gardés. Vous pouvez relancer tout de suite.',
    },
  },

  download: {
    verifying: 'Vérification du fichier',
    announcement: (percent: number) => `Téléchargement : ${percent} %`,
    lessThanAMinuteLeft: 'moins d’une minute restante',
    minutesLeft: (n: number) => `environ ${n} minute${n > 1 ? 's restantes' : ' restante'}`,
  },

  duration: {
    lessThanAMinute: 'Moins d’une minute',
    about: (n: number) => `Environ ${minutes(n)}`,
    almostDone: 'Presque terminé',
    lessThanAMinuteLeft: 'Encore moins d’une minute',
    aboutLeft: (n: number) => `Encore environ ${minutes(n)}`,
    elapsedSeconds: (s: number) => `Depuis ${s} s`,
    elapsed: (m: number, s: string) => `Depuis ${m} min ${s} s`,
  },

  /** Generation steps, in the user's words. */
  generationSteps: [
    'Je lis l’annonce',
    'Je choisis ce qui vous met en valeur',
    'J’écris votre phrase de présentation',
    'Je mets votre CV en page',
  ],

  savedLocation: {
    /** Known folders, by their (lower case) name on disk. */
    knownFolders: {
      desktop: 'sur votre Bureau',
      bureau: 'sur votre Bureau',
      documents: 'dans vos Documents',
      downloads: 'dans vos Téléchargements',
      téléchargements: 'dans vos Téléchargements',
    } as Record<string, string>,
    computer: 'Enregistré sur votre ordinateur',
    known: (place: string) => `Enregistré ${place}`,
    folder: (folder: string) => `Enregistré dans le dossier « ${folder} »`,
  },

  photo: {
    unsupportedFormat: 'Format non pris en charge : choisissez une image JPEG, PNG ou WebP.',
    tooLarge: 'Cette image est trop volumineuse (15 Mo maximum).',
    unprocessable: 'Impossible de traiter cette image.',
  },

  /** Locale for dates and times. */
  locale: 'fr-FR',

  welcome: {
    badge: 'Gratuit · sans compte',
    badgeLocal: 'Gratuit · sans compte · sur votre ordinateur',
    title: 'Un CV adapté à chaque annonce, en quelques minutes.',
    intro:
      'Importez votre CV, indiquez l’annonce qui vous intéresse : Re:CV met en avant ce qui compte pour ce poste. Vous relisez et validez chaque changement.',
    start: 'Commencer',
    duration: 'Environ 5 minutes la première fois',
    promises: {
      online:
        'Votre CV est enregistré sur votre ordinateur. Il est lu par le service en ligne choisi dans les Réglages.',
      local: 'Votre CV reste sur votre ordinateur. Rien n’est envoyé.',
      editable: 'Vous pouvez tout modifier avant de télécharger.',
      formats: 'Vous repartez avec un PDF ou un fichier Word.',
    },
  },

  setup: {
    title: 'On prépare Re:CV',
    intro: {
      start: 'Pour travailler sans rien envoyer sur internet, Re:CV a besoin d’un fichier',
      sizePrefix: 'd’environ',
      unknownSize: ' volumineux',
      onceBefore: '. Il se télécharge ',
      once: 'une seule fois',
      onceAfter: ' ; ensuite, l’application fonctionne même sans connexion.',
    },
    interrupted: 'Téléchargement interrompu',
    verifying: 'Vérification du fichier… quelques secondes',
    progress: (received: string, total: string) => `${received} sur ${total}`,
    starting: 'Démarrage…',
    progressLabel: 'Téléchargement',
    tips: [
      'Gardez l’ordinateur allumé et connecté à internet. Vous pouvez réduire cette fenêtre.',
      'Si la connexion coupe, le téléchargement reprendra là où il s’était arrêté.',
    ],
    later: 'Plus tard',
    otherOption: 'Choisir une autre option dans les Réglages',
  },

  success: {
    title: 'Votre CV est prêt à envoyer',
    tailoredFor: (jobTitle: string) =>
      `Il est adapté à l’annonce « ${jobTitle} ». Bonne chance pour votre candidature !`,
    openFolder: 'Ouvrir le dossier',
    openCv: 'Ouvrir le CV',
    openFailed: (path: string) => `Le fichier ne s’ouvre pas tout seul. Vous le trouverez à cet endroit : ${path}`,
    anotherTitle: 'Une autre annonce vous intéresse ?',
    another: 'Adapter pour une autre offre',
    anotherText: 'Votre CV de départ est gardé : vous n’aurez qu’à indiquer la nouvelle annonce.',
  },

  updates: {
    title: 'Mises à jour',
    installedVersion: (version: string) => `Version installée : ${version}`,
    upToDate: 'Re:CV est à jour.',
    upToDateAt: (time: string) => `Re:CV est à jour (vérifié à ${time}).`,
    checking: 'Recherche d’une mise à jour…',
    nextVersion: 'suivante',
    downloading: (version: string, percent: number) => `Téléchargement de la version ${version}… ${percent} %`,
    ready: (version: string) => `La version ${version} est prête. Elle s’installera à la fermeture de Re:CV.`,
    error: 'Impossible de vérifier les mises à jour pour l’instant. Vérifiez votre connexion, puis réessayez.',
    unavailable: 'Les mises à jour automatiques ne concernent que l’application installée.',
    none: 'Aucune vérification pour l’instant.',
    progressLabel: 'Téléchargement de la mise à jour',
    restart: 'Redémarrer maintenant',
    check: 'Rechercher une mise à jour',
  },

  jobPosting: {
    title: 'Quelle annonce vous intéresse ?',
    subtitle: 'Donnez-nous l’adresse de l’annonce. Si le site ne se laisse pas lire, collez simplement son texte.',
    backToCv: 'Revenir à mon CV',
    loading: {
      openingPage: 'Nous ouvrons la page de l’annonce…',
      reading: 'Nous lisons l’annonce…',
      analysing: 'Nous repérons le poste et ce que l’employeur recherche',
      note: 'Cela prend généralement moins d’une minute.',
    },
    input: {
      modesLabel: 'Façon de donner l’annonce',
      link: 'Coller un lien',
      text: 'Coller le texte',
      urlLabel: 'Adresse de l’annonce',
      urlPlaceholder: 'Collez ici l’adresse (elle commence par https://)',
      urlHint: 'Astuce : dans votre navigateur, cliquez sur la barre d’adresse puis faites Ctrl + C pour copier.',
      textLabel: 'Texte de l’annonce',
      textPlaceholder: 'Collez ici tout le texte de l’annonce',
      textHint:
        'Astuce : sur la page de l’annonce, sélectionnez le texte avec la souris, faites Ctrl + C, puis Ctrl + V ici.',
      read: 'Lire l’annonce',
    },
    confirm: {
      kicker: 'Annonce lue',
      title: 'C’est bien cette annonce ?',
      wrongPosting: 'Ce n’est pas la bonne annonce',
      create: 'Créer mon CV adapté',
    },
    card: {
      sought: 'Ce que l’employeur recherche',
      goodToKnow: 'Bon à savoir :',
      fullText: 'Voir le texte complet de l’annonce',
      jobTitleLabel: 'Intitulé du poste',
      textLabel: 'Texte de l’annonce',
      reread: 'Relire l’annonce corrigée',
      keep: 'Ne rien changer',
      correct: 'Corriger le texte',
    },
    /** What the job posting wishes for and the CV does not show: said without discouraging. */
    goodToKnow: {
      experienceNotFound: (required: string) => `l’annonce souhaite « ${required} ». Cela n’apparaît pas dans votre CV`,
      educationInsufficient: (required: string) => `l’annonce demande « ${required} »`,
      profileEducation: (value: string) => ` (votre CV indique « ${value} »)`,
      separator: ' ; ',
      conclusion: (sentences: string) => `${sentences}, mais cela ne vous empêche pas de postuler.`,
    },
  },

  generating: {
    title: (jobTitle: string) => `Nous préparons votre CV pour « ${jobTitle} »`,
    duration: (duration: string) => `${duration}. Vous pouvez réduire la fenêtre en attendant.`,
    stepAnnouncement: (step: string) => `${step} : en cours`,
    stepStates: { done: 'Fait', current: 'En cours', upcoming: 'À venir' },
    progressLabel: 'Avancement de la création',
    longTitle: 'C’est plus long que prévu, mais ça avance',
    keepWaiting: 'Continuer d’attendre',
    cancel: 'Annuler',
    slowCpu: 'Votre ordinateur calcule sans aide de la carte graphique. ',
    slow: 'Votre ordinateur calcule encore. ',
    partialGpu: (layers: number, total: number) =>
      `Seule une partie du modèle tient sur votre carte graphique (${layers} couches sur ${total}) : le reste est calculé par le processeur. `,
    fasterNextTime: 'Pour aller plus vite la prochaine fois, choisissez « Rapide » dans les Réglages.',
    privacyOnline:
      'Votre CV et l’annonce sont envoyés au service en ligne choisi dans les Réglages, le temps de la création.',
    privacyLocal:
      'Votre ordinateur fait tout le travail lui-même : c’est parfois un peu long, mais rien ne sort de chez vous.',
  },

  newCv: {
    ready: 'Votre CV est prêt',
    title: 'Relisez, ajustez si besoin, puis téléchargez',
    headlineSection: 'Titre et présentation',
    headlineLabel: 'Titre du CV',
    summaryLabel: 'Phrase de présentation',
    showChanges: 'Voir ce qui a changé',
    backToPreview: 'Revenir à l’aperçu',
    layout: (template: string, pages: number) => `Mise en page « ${template} » · ${pages} page${pages > 1 ? 's' : ''}`,
    word: 'Version Word (.docx)',
    pdf: 'Télécharger en PDF',
    highlighted: {
      title: 'Compétences mises en avant',
      present: 'Déjà dans votre CV · placées en premier',
      missing: 'Demandées par l’annonce, absentes de votre CV',
      missingWarning:
        'Cochez seulement ce que vous savez vraiment faire : on pourra vous interroger dessus en entretien.',
    },
    keptExperiences: {
      title: 'Expériences dans ce CV',
      summary: 'Décochez celles que vous ne voulez pas montrer',
      legend: 'Une expérience décochée n’apparaît que sur ce CV : votre profil n’est pas modifié.',
    },
    excluded: {
      title: 'Retiré de ce CV',
      summary: 'Sans rapport avec l’annonce · vous pouvez le remettre',
      legend: 'Cochez ce que vous voulez remettre. Une expérience revient avec ses phrases de départ.',
    },
    gallery: {
      layout: 'Mise en page',
      thumbnail: (template: string) => `Aperçu de la mise en page ${template}`,
      previewLabel: 'Aperçu de votre CV',
      previewFrame: (template: string) => `Votre CV, mise en page ${template}`,
      previewFailed: 'L’aperçu n’a pas pu s’afficher. Vous pouvez quand même télécharger votre CV.',
      layingOut: 'Nous mettons votre CV en page…',
    },
  },

  whatChanged: {
    title: 'Ce qui a changé',
    intro:
      'Vos postes, dates et formations ne changent pas : nous choisissons et réordonnons ce qui vient de votre CV.',
    before: 'Dans votre CV de départ',
    after: 'Dans ce nouveau CV',
    empty: '—',
    headline: {
      title: 'Titre du CV',
      label: 'Titre adapté à l’annonce',
      keep: 'Utiliser le titre adapté',
    },
    summary: {
      title: 'Phrase de présentation',
      label: 'Phrase adaptée à l’annonce',
      keep: 'Utiliser la phrase adaptée',
    },
    experience: {
      label: 'Ce que vous avez fait (une idée par ligne)',
      keep: 'Utiliser les phrases choisies pour cette annonce',
      keepHint: 'Décochée : toutes vos phrases de départ sont reprises, dans leur ordre.',
    },
    skills: {
      title: 'Compétences',
      keep: 'Utiliser la sélection adaptée',
      keepHint: 'Les compétences utiles pour cette annonce, celles qu’elle demande en premier.',
    },
  },

  myCv: {
    import: {
      title: 'Commençons par votre CV',
      subtitle: 'Nous allons le lire pour comprendre votre parcours. Vous pourrez tout vérifier juste après.',
      reading: 'Nous lisons votre CV…',
      readingNew: 'Nous lisons votre nouveau CV…',
      readingStep: 'Nous repérons vos expériences, vos compétences et vos formations',
      readingNote: 'Cela prend une à deux minutes. Vous pouvez réduire la fenêtre en attendant.',
      partialGpu: (layers: number, total: number) =>
        `Seule une partie du modèle tient sur votre carte graphique (${layers} couches sur ${total}) : le reste est calculé par le processeur, c’est plus lent. Fermer les autres applications qui utilisent la carte graphique aide.`,
      readingNewNote: 'Votre CV actuel reste affiché tant que la lecture n’est pas terminée.',
      privacyOnline: 'Votre CV sera lu par le service en ligne choisi dans les Réglages : il quitte votre ordinateur.',
      privacyLocal: 'Votre CV reste sur cet ordinateur : il n’est envoyé nulle part.',
    },
    summaryCard: {
      read: 'Votre CV est lu',
      untitled: 'Votre CV',
      savedCv: 'Votre CV enregistré',
      otherCv: 'Utiliser un autre CV',
      counts: {
        experiences: ['expérience', 'expériences'] as [string, string],
        education: ['formation', 'formations'] as [string, string],
        skills: ['compétence ou qualité', 'compétences et qualités'] as [string, string],
        languages: ['langue', 'langues'] as [string, string],
      },
    },
    check: {
      title: 'Vérifiez ce que nous avons compris',
      text: 'Ouvrez une partie pour la corriger. Si tout vous semble juste, vous pouvez continuer directement.',
    },
    saveFailed: {
      title: 'Vos corrections n’ont pas pu être enregistrées',
      text: 'Rien n’est perdu : elles sont toujours affichées. Réessayez dans un instant.',
    },
    autosaved: 'Vos corrections sont enregistrées automatiquement.',
    autosaveFailed:
      'Vos dernières corrections ne sont pas encore enregistrées. Elles le seront quand vous continuerez.',
    next: 'Ça me va, continuer',
    contact: {
      title: 'Vos coordonnées',
      summary: 'Nom, métier, e-mail, téléphone, ville',
      singleWordName:
        'Un seul mot dans « Prénom et nom » : il manque peut-être votre prénom (il apparaît en tête du CV).',
      fullName: 'Prénom et nom',
      headline: 'Votre métier actuel',
      email: 'E-mail',
      phone: 'Téléphone',
      location: 'Ville ou département',
      links: 'Liens (facultatif)',
      linksPlaceholder: 'Ex. : votre page LinkedIn',
      summaryLabel: 'Votre phrase de présentation',
      summaryHint: 'Elle parle de vos qualités, pas d’un métier : elle reste valable pour toutes les annonces.',
      suggest: 'Proposer une phrase',
      suggesting: 'Nous cherchons une phrase qui vous ressemble…',
      suggestingStep: 'À partir de vos qualités',
      suggested: 'Voici une proposition : relisez-la et ajustez-la si besoin.',
      suggestFailed: 'La proposition n’a pas abouti. Réessayez.',
    },
    experiences: {
      title: 'Vos expériences',
      untitled: 'Expérience sans intitulé',
      numbered: (n: number) => `Expérience ${n}`,
      position: 'Poste',
      company: 'Entreprise',
      dates: 'Dates',
      datesPlaceholder: 'Ex. : 2019 – 2024',
      location: 'Ville',
      description: 'En une phrase (facultatif)',
      achievements: 'Ce que vous avez fait (une idée par ligne)',
      removeLabel: (name: string) => `Retirer l’expérience « ${name} »`,
      remove: 'Retirer cette expérience',
      add: 'Ajouter une expérience',
      none: 'Aucune expérience pour l’instant',
      more: (n: number) => ` · et ${n} autre${n > 1 ? 's' : ''}`,
    },
    skills: {
      title: 'Compétences et qualités',
      label: 'Vos compétences et qualités (une par ligne)',
      hint: 'Quelques mots suffisent : « Organisation », « Travail en équipe », « Gestion des stocks ».',
      none: 'Aucune compétence pour l’instant',
    },
    education: {
      title: 'Formations',
      untitled: 'Formation sans intitulé',
      numbered: (n: number) => `Formation ${n}`,
      degree: 'Diplôme',
      school: 'Établissement',
      year: 'Année',
      removeLabel: (name: string) => `Retirer la formation « ${name} »`,
      remove: 'Retirer cette formation',
      add: 'Ajouter une formation',
      none: 'Aucune formation pour l’instant',
    },
    languages: {
      title: 'Langues',
      untitled: 'Langue sans nom',
      name: 'Langue',
      level: 'Niveau',
      removeLabel: (name: string) => `Retirer la langue « ${name} »`,
      remove: 'Retirer',
      add: 'Ajouter une langue',
      none: 'Aucune langue pour l’instant',
      withLevel: (name: string, level: string) => `${name} : ${level}`,
      /** CEFR levels. The value is written on the CV (« Anglais (C1) »): it is in the language of the CV. */
      levels: [
        { value: '', label: 'Niveau non précisé' },
        { value: 'Langue maternelle', label: 'Langue maternelle' },
        { value: 'C2', label: 'C2 — Maîtrise' },
        { value: 'C1', label: 'C1 — Autonome, courant' },
        { value: 'B2', label: 'B2 — Intermédiaire supérieur' },
        { value: 'B1', label: 'B1 — Intermédiaire' },
        { value: 'A2', label: 'A2 — Élémentaire' },
        { value: 'A1', label: 'A1 — Débutant' },
      ],
    },
    photo: {
      title: 'Photo',
      optional: 'facultative',
      chosen: 'Une photo est choisie · elle reste sur votre ordinateur',
      none: 'Aucune photo · elle reste sur votre ordinateur',
      alt: 'Votre portrait',
      placeholder: 'Aucune',
      change: 'Changer la photo',
      add: 'Ajouter une photo',
      remove: 'Retirer la photo',
      note: 'Elle apparaît seulement dans les mises en page qui en prévoient une. Elle est recadrée en carré et reste sur votre ordinateur.',
    },
    undo: {
      removed: (label: string) => `Élément retiré : « ${label} ».`,
      undo: 'Annuler',
    },
  },

  settings: {
    title: 'Réglages',
    subtitle: 'La plupart des personnes n’ont rien à changer ici.',
    loading: 'Un instant…',
    saved: 'Vos réglages sont enregistrés.',
    savedKeyCleared: 'Réglages enregistrés. Le service a changé : saisissez à nouveau votre clé personnelle.',
    keyRemoved: 'Votre clé personnelle est supprimée.',
    unsaved: 'Des modifications ne sont pas encore enregistrées.',
    save: 'Enregistrer les réglages',
    engine: {
      title: 'Moteur d’intelligence artificielle',
      subtitle: 'C’est lui qui lit votre CV et l’annonce.',
      legend: 'Où tourne le moteur : sur cet ordinateur, ou avec Ollama ou un service en ligne (options avancées)',
      local: 'Sur mon ordinateur',
      recommended: 'Recommandé',
      localDescription: 'Gratuit et privé : rien ne quitte votre ordinateur. Fonctionne sans internet.',
      ready: 'Prêt à l’emploi',
      missing: 'Il manque un téléchargement : installez un niveau ci-dessous',
      advanced: 'Options avancées',
      advancedHint: 'Pour les personnes à l’aise avec l’informatique',
      ollama: 'Ollama (installé séparément)',
      ollamaDescription: 'Utilise un modèle servi par Ollama sur cet ordinateur. Les données restent chez vous.',
      online: 'Service en ligne avec ma clé personnelle',
      onlineDescription:
        'OpenAI, Mistral, OpenRouter… Rapide, mais payant selon le service. Votre CV et les annonces sont envoyés à ce service : ils ne restent pas sur votre ordinateur.',
      rewrite: 'Réécrire les phrases de mes expériences',
      rewriteHint:
        'Désactivé : Re:CV choisit vos phrases les plus proches de l’annonce, sans les modifier. Activé : il les reformule, ce qui ajoute plusieurs minutes.',
      reduceGpuMemory: 'Économiser la mémoire de la carte graphique',
      reduceGpuMemoryHint:
        'À essayer si la création est très lente : une partie plus grande du modèle tient alors sur la carte graphique. Les CV et annonces très longs peuvent être mieux lus sans cette option.',
      modelFile: 'Fichier du modèle (.gguf)',
      noModelFile: 'Aucun fichier choisi : Re:CV utilise le niveau installé ci-dessus.',
      chooseModelFile: 'Choisir un fichier…',
      modelFileWarning:
        'Ce fichier est exécuté par Re:CV : choisissez uniquement un modèle téléchargé depuis une source de confiance.',
    },
    levels: {
      legend: 'Rapidité ou soin du résultat',
      /** The three local models, named by what they change for the user. */
      names: {
        fast: { name: 'Rapide', detail: 'Pour les ordinateurs modestes' },
        balanced: { name: 'Équilibré', detail: 'Bon résultat sur la plupart des ordinateurs' },
        quality: { name: 'Soigné', detail: 'Meilleur résultat' },
      },
      understood: 'Compris',
      recommended: ' · conseillé pour votre ordinateur',
      slow: ', mais lent sur votre ordinateur',
      installed: (size: string) => `Installé · ${size}`,
      toDownload: (detail: string, size: string) => `${detail} · ${size} à télécharger`,
      remove: 'Supprimer',
      pause: 'Mettre en pause',
      install: 'Installer',
      progressLabel: (level: string) => `Téléchargement du niveau ${level}`,
      verifying: 'Vérification du fichier… quelques secondes',
      progress: (received: string, total: string, percent: number) => `${received} sur ${total} (${percent} %)`,
      paused: 'En pause : le téléchargement reprendra là où il s’était arrêté.',
    },
    ollama: {
      url: 'Adresse d’Ollama',
      model: 'Modèle',
      remote: 'Cette adresse n’est pas celle de votre ordinateur.',
      remoteText: 'Votre CV et l’annonce seront envoyés à cet appareil',
      unencrypted: ', sans chiffrement sur le réseau',
      end: '.',
    },
    online: {
      warning: 'Votre CV et l’annonce seront envoyés à ce service.',
      warningText: 'Ils quittent votre ordinateur à chaque création de CV.',
      service: 'Service',
      otherService: 'Autre adresse',
      key: 'Clé personnelle (API)',
      keySaved: '•••••••••••• (enregistrée)',
      url: 'Adresse du service',
      urlHint: 'Elle commence par https:// et finit souvent par /v1.',
      model: 'Modèle',
      modelHint: 'Le nom donné par le service, par exemple « mistral-small-latest ».',
      hasKey: 'Une clé est enregistrée, chiffrée sur votre ordinateur. Elle n’est jamais réaffichée.',
      noKey: 'Aucune clé enregistrée pour l’instant.',
      removeKey: 'Supprimer la clé',
    },
    diagnostics: {
      title: 'Signaler un problème',
      subtitle:
        'Le rapport aide à comprendre un problème : versions de Re:CV et de Windows, moteur choisi, mémoire de l’ordinateur et codes des dernières erreurs. Il ne contient rien de votre CV.',
      copy: 'Copier le rapport',
      copied: 'Rapport copié. Collez-le dans votre signalement avec Ctrl + V.',
      failed: 'Le rapport n’a pas pu être copié. Réessayez dans un instant.',
      show: 'Voir le contenu du rapport',
    },
    data: {
      title: 'Mes données',
      subtitle: 'Votre CV, vos annonces et les CV créés sont enregistrés uniquement sur cet ordinateur.',
      erase: 'Tout effacer…',
      confirmTitle: 'Tout effacer définitivement ?',
      confirm: 'Oui, tout effacer',
      cancel: 'Non, garder mes données',
      confirmText:
        'Votre CV importé, vos annonces et vos CV créés seront supprimés de Re:CV. Les fichiers déjà téléchargés sur votre ordinateur ne sont pas touchés. Les réglages sont gardés',
      confirmKey: ', sauf votre clé personnelle, effacée elle aussi',
      end: '.',
      failed: 'Vos données n’ont pas pu être effacées',
    },
  },

  /** Names of the CV layouts (`core/export/templates.ts`). */
  templates: {
    classic: 'Classique',
    modern: 'Moderne',
    elegant: 'Élégant',
    banner: 'Bandeau',
    sidebar: 'Latéral',
    pastel: 'Pastel',
  } satisfies Record<TemplateId, string> as Record<TemplateId, string>,
}
