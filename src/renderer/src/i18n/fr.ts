// Texts of the interface, in French (vouvoiement). Every visible text lives here: another language is a file of the
// same shape (`Texts`). Texts that depend on a number or a name are functions.

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
    updateReady: 'Mise à jour prête',
    settings: 'Réglages',
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
}
