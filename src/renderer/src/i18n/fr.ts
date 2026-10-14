// Texts of the interface, in French (vouvoiement). Every visible text lives here: another language is a file of the
// same shape (`Texts`). Texts that depend on a number or a name are functions.

const minutes = (n: number) => `${n} minute${n > 1 ? 's' : ''}`

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
    notReady: {
      title: 'Re:CV n’est pas encore tout à fait prêt',
      text: 'Il manque un téléchargement unique. Ensuite, plus besoin d’internet.',
      action: 'Terminer la préparation',
    },
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

  errorAlert: { details: 'Détails' },

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
}
