import type { Education, Experience, Language, Profile } from '@core/schemas'
import { useEffect, useRef, useState } from 'react'
import { type AutosaveStatus, createAutosave } from '../autosave'
import { type ActionErreur, type DescriptionErreur, decrireErreur, messageErreur } from '../erreurs'
import { compter, initiales } from '../parcours'
import { reduirePhoto } from '../photo'
import { useProgressionTache } from '../progression'
import {
  Alerte,
  AlerteErreur,
  BarreActions,
  Bouton,
  Champ,
  Chargement,
  Icone,
  Pastille,
  SectionRepliable,
  Selection,
  Titre,
  ZoneDepot,
} from '../ui'

const lignes = (texte: string) => texte.split('\n')
const nettoyer = (valeurs: string[]) => valeurs.map((v) => v.trim()).filter(Boolean)

// Les listes éditées gardent leurs lignes vides pendant la saisie ; on les retire à l'enregistrement.
function nettoyerProfil(profil: Profile): Profile {
  return {
    ...profil,
    links: nettoyer(profil.links),
    skills: nettoyer(profil.skills),
    experiences: profil.experiences.map((e) => ({ ...e, realisations: nettoyer(e.achievements) })),
  }
}

// Niveaux du CECRL. La valeur enregistrée est celle qui apparaît sur le CV (« Anglais (C1) »).
const NIVEAUX_LANGUE = [
  { valeur: '', libelle: 'Niveau non précisé' },
  { valeur: 'Langue maternelle', libelle: 'Langue maternelle' },
  { valeur: 'C2', libelle: 'C2 — Maîtrise' },
  { valeur: 'C1', libelle: 'C1 — Autonome, courant' },
  { valeur: 'B2', libelle: 'B2 — Intermédiaire supérieur' },
  { valeur: 'B1', libelle: 'B1 — Intermédiaire' },
  { valeur: 'A2', libelle: 'A2 — Élémentaire' },
  { valeur: 'A1', libelle: 'A1 — Débutant' },
]

// Conserve un niveau déjà présent (ex. « Courant » extrait d'un CV) même s'il n'est pas dans la liste.
function optionsNiveau(courant: string) {
  return courant && !NIVEAUX_LANGUE.some((n) => n.valeur === courant)
    ? [...NIVEAUX_LANGUE, { valeur: courant, libelle: courant }]
    : NIVEAUX_LANGUE
}

// Pause in typing after which the draft is saved.
const AUTOSAVE_DELAY_MS = 800

const experienceVide = (): Experience => ({ position: '', company: '', achievements: [] })
const formationVide = (): Education => ({ degree: '', school: '' })
const langueVide = (): Language => ({ name: '' })

function remplacer<T>(liste: T[], indice: number, valeur: T): T[] {
  return liste.map((element, i) => (i === indice ? valeur : element))
}

const joindre = (...parties: (string | undefined)[]) => parties.filter((p) => p && p.trim() !== '').join(', ')

function resumeExperiences(experiences: Experience[]): string {
  const premiere = experiences[0]
  if (!premiere) return 'Aucune expérience pour l’instant'
  const reste = experiences.length - 1
  const suite = reste > 0 ? ` · et ${reste} autre${reste > 1 ? 's' : ''}` : ''
  return joindre(premiere.position, premiere.company, premiere.dateRange) + suite
}

function resumeCompetences(competences: string[]): string {
  const propres = nettoyer(competences)
  if (propres.length === 0) return 'Aucune compétence pour l’instant'
  return propres.slice(0, 4).join(', ') + (propres.length > 4 ? '…' : '')
}

/** Étape ① : dépôt du CV, puis vérification de ce qui a été compris, par sections repliables. */
export function EcranMonCv({
  profil,
  nomFichier,
  enLigne,
  onProfil,
  onSuivant,
  onPreparer,
}: {
  profil: Profile | null
  /** Nom du fichier importé, s'il est connu. */
  nomFichier: string | null
  /** Un service en ligne est choisi dans les réglages : on ne promet pas que rien n'est envoyé. */
  enLigne: boolean
  onProfil: (profil: Profile, nomFichier?: string) => void
  onSuivant: () => void
  /** Ouvre l'écran de préparation (moteur pas encore prêt). */
  onPreparer: () => void
}) {
  const [brouillon, setBrouillon] = useState<Profile | null>(profil)
  const [occupe, setOccupe] = useState<'import' | 'enregistrement' | 'accroche' | null>(null)
  const [erreur, setErreur] = useState<DescriptionErreur | null>(null)
  // Retour affiché sous le champ : le haut de page est hors de vue quand on est au milieu du formulaire.
  const [retourAccroche, setRetourAccroche] = useState<{ type: 'erreur' | 'succes'; texte: string } | null>(null)
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null)
  const champPhoto = useRef<HTMLInputElement>(null)
  const dernierImport = useRef<(() => void) | null>(null)
  const progressionImport = useProgressionTache('import', occupe === 'import')
  const progressionAccroche = useProgressionTache('accroche', occupe === 'accroche')
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus | null>(null)
  const [autosave] = useState(() =>
    createAutosave<Profile>({
      delayMs: AUTOSAVE_DELAY_MS,
      save: async (draft) => void (await window.api.saveProfile(nettoyerProfil(draft))),
      onStatus: setSaveStatus,
    }),
  )
  // The draft differs from the profile known to the app: it is saved after a pause, and handed to the app
  // when the screen is left by any route (stepper, settings), so that no correction is lost.
  const dirty = useRef(false)
  const latest = useRef({ brouillon, onProfil })
  latest.current = { brouillon, onProfil }

  useEffect(() => {
    dirty.current = false
    autosave.cancel()
    setBrouillon(profil)
  }, [profil, autosave])

  useEffect(() => {
    if (dirty.current && brouillon) autosave.schedule(brouillon)
  }, [brouillon, autosave])

  useEffect(
    () => () => {
      if (!dirty.current) return
      const { brouillon: draft, onProfil: handOver } = latest.current
      void autosave.flush().then(() => {
        if (draft) handOver(nettoyerProfil(draft))
      })
    },
    [autosave],
  )

  const importer = async (fichier?: File) => {
    dernierImport.current = () => void importer(fichier)
    setOccupe('import')
    setErreur(null)
    try {
      const resultat = fichier ? await window.api.importDroppedCv(fichier) : await window.api.importCv()
      if (resultat) onProfil(resultat.profile, resultat.fileName)
    } catch (e) {
      setErreur(decrireErreur('cv', e))
    } finally {
      setOccupe(null)
    }
  }

  const surActionErreur = (action: ActionErreur) => {
    setErreur(null)
    if (action === 'terminer-preparation') onPreparer()
    else if (action === 'reessayer') dernierImport.current?.()
    else void importer()
  }

  const continuer = async () => {
    if (!brouillon) return
    setOccupe('enregistrement')
    setErreur(null)
    autosave.cancel()
    try {
      const { profile: enregistre } = await window.api.saveProfile(nettoyerProfil(brouillon))
      dirty.current = false
      onProfil(enregistre)
      onSuivant()
    } catch (e) {
      setErreur({
        type: 'erreur',
        icone: 'recommencer',
        titre: 'Vos corrections n’ont pas pu être enregistrées',
        texte: 'Rien n’est perdu : elles sont toujours affichées. Réessayez dans un instant.',
        actions: [],
        details: messageErreur(e),
      })
      setOccupe(null)
    }
  }

  // Phrase générique, fondée sur les qualités : valable quelle que soit l'annonce visée.
  const proposerPhrase = async () => {
    if (!brouillon) return
    setOccupe('accroche')
    setRetourAccroche(null)
    try {
      const accroche = await window.api.generateSummary(nettoyerProfil(brouillon))
      maj({ summary: accroche })
      setRetourAccroche({ type: 'succes', texte: 'Voici une proposition : relisez-la et ajustez-la si besoin.' })
    } catch (e) {
      const description = decrireErreur('creation', e)
      setRetourAccroche({
        type: 'erreur',
        texte: description.code === 'moteur-absent' ? description.titre : 'La proposition n’a pas abouti. Réessayez.',
      })
    } finally {
      setOccupe(null)
    }
  }

  function maj(partiel: Partial<Profile>) {
    dirty.current = true
    setBrouillon((p) => (p ? { ...p, ...partiel } : p))
  }

  if (!brouillon) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
        <Titre sousTitre="Nous allons le lire pour comprendre votre parcours. Vous pourrez tout vérifier juste après.">
          Commençons par votre CV
        </Titre>
        {erreur && <AlerteErreur description={erreur} surAction={surActionErreur} />}
        {occupe === 'import' ? (
          <Chargement
            titre="Nous lisons votre CV…"
            etape={progressionImport ? 'Nous repérons vos expériences, vos compétences et vos formations' : undefined}
            note="Cela prend une à deux minutes. Vous pouvez réduire la fenêtre en attendant."
          />
        ) : (
          <ZoneDepot onFichier={(fichier) => void importer(fichier)} onChoisir={() => void importer()} />
        )}
        <p className="flex items-center gap-3 text-intro text-encre">
          <Icone nom="cadenas" className="text-marque" />
          {enLigne
            ? 'Votre CV sera lu par le service en ligne choisi dans les Réglages : il quitte votre ordinateur.'
            : 'Votre CV reste sur cet ordinateur : il n’est envoyé nulle part.'}
        </p>
      </div>
    )
  }

  const nom = (brouillon.fullName ?? '').trim()
  const sousTitre = [brouillon.headline, brouillon.location].filter((v) => v && v.trim() !== '').join(' · ')
  const nbCompetences = nettoyer(brouillon.skills).length
  const comptes = [
    compter(brouillon.experiences.length, 'expérience', 'expériences'),
    compter(brouillon.education.length, 'formation', 'formations'),
    compter(nbCompetences, 'compétence ou qualité', 'compétences et qualités'),
    compter(brouillon.languages.length, 'langue', 'langues'),
  ]

  return (
    <>
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-10">
        <section className="sur-sombre space-y-5 rounded-panneau bg-encre p-7 text-white shadow-panneau">
          <p className="flex items-center gap-2 font-bold text-accent">
            <Icone nom="coche-cercle" />
            Votre CV est lu
          </p>
          <div className="flex items-center gap-5">
            {brouillon.photo ? (
              <img
                src={brouillon.photo}
                alt=""
                className="size-[72px] rounded-full border-2 border-accent object-cover"
              />
            ) : (
              <span
                className="flex size-[72px] shrink-0 items-center justify-center rounded-full border-2 border-accent bg-white/10 font-titre text-2xl font-bold"
                aria-hidden="true"
              >
                {initiales(nom) || '?'}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate font-titre text-[1.75rem] leading-tight font-bold">{nom || 'Votre CV'}</h1>
              {sousTitre && <p className="truncate text-intro text-white/85">{sousTitre}</p>}
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {comptes.map((c) => (
              <li key={c.nom}>
                <Pastille variante="sur-sombre">
                  <strong>{c.nombre}</strong> {c.nom}
                </Pastille>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-5">
            <p className="flex min-w-0 items-center gap-2.5 text-white/90">
              <Icone nom="fichier" taille={18} />
              <span className="truncate">{nomFichier ?? 'Votre CV enregistré'}</span>
            </p>
            <Bouton variante="sur-sombre" onClick={() => void importer()} enCours={occupe === 'import'}>
              Utiliser un autre CV
            </Bouton>
          </div>
        </section>

        {occupe === 'import' && (
          <Chargement
            titre="Nous lisons votre nouveau CV…"
            etape={progressionImport ? 'Nous repérons vos expériences, vos compétences et vos formations' : undefined}
            note="Votre CV actuel reste affiché tant que la lecture n’est pas terminée."
          />
        )}
        {erreur && <AlerteErreur description={erreur} surAction={surActionErreur} />}

        <header className="space-y-1 pt-2">
          <h2 className="font-titre text-titre-section font-bold">Vérifiez ce que nous avons compris</h2>
          <p className="text-corps text-encre-douce">
            Ouvrez une partie pour la corriger. Si tout vous semble juste, vous pouvez continuer directement.
          </p>
        </header>

        <div className="space-y-3">
          <SectionRepliable titre="Vos coordonnées" resume="Nom, métier, e-mail, téléphone, ville" ouverte>
            {nom !== '' && !/\s/.test(nom) && (
              <Alerte type="avertissement">
                Un seul mot dans « Prénom et nom » : il manque peut-être votre prénom (il apparaît en tête du CV).
              </Alerte>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                etiquette="Prénom et nom"
                autoComplete="name"
                valeur={brouillon.fullName ?? ''}
                onChange={(v) => maj({ fullName: v })}
              />
              <Champ
                etiquette="Votre métier actuel"
                autoComplete="organization-title"
                valeur={brouillon.headline ?? ''}
                onChange={(v) => maj({ headline: v })}
              />
              <Champ
                etiquette="E-mail"
                type="email"
                autoComplete="email"
                valeur={brouillon.email ?? ''}
                onChange={(v) => maj({ email: v })}
              />
              <Champ
                etiquette="Téléphone"
                type="tel"
                autoComplete="tel"
                valeur={brouillon.phone ?? ''}
                onChange={(v) => maj({ phone: v })}
              />
              <Champ
                etiquette="Ville ou département"
                autoComplete="address-level2"
                valeur={brouillon.location ?? ''}
                onChange={(v) => maj({ location: v })}
              />
              <Champ
                etiquette="Liens (facultatif)"
                valeur={brouillon.links.join(', ')}
                placeholder="Ex. : votre page LinkedIn"
                onChange={(v) => maj({ links: v.split(/,\s*/) })}
              />
            </div>
            <Champ
              etiquette="Votre phrase de présentation"
              multiligne
              lignes={3}
              valeur={brouillon.summary ?? ''}
              onChange={(v) => maj({ summary: v })}
              aide="Elle parle de vos qualités, pas d’un métier : elle reste valable pour toutes les annonces."
              action={
                <Bouton
                  variante="contour"
                  taille="petit"
                  onClick={() => void proposerPhrase()}
                  enCours={occupe === 'accroche'}
                  desactive={occupe !== null}
                >
                  Proposer une phrase
                </Bouton>
              }
            />
            {occupe === 'accroche' && (
              <Chargement
                titre="Nous cherchons une phrase qui vous ressemble…"
                etape={progressionAccroche ? 'À partir de vos qualités' : undefined}
              />
            )}
            {retourAccroche && <Alerte type={retourAccroche.type}>{retourAccroche.texte}</Alerte>}
          </SectionRepliable>

          <SectionRepliable
            titre="Vos expériences"
            compte={brouillon.experiences.length}
            resume={resumeExperiences(brouillon.experiences)}
          >
            {brouillon.experiences.map((experience, i) => {
              const majExperience = (partiel: Partial<Experience>) =>
                maj({ experiences: remplacer(brouillon.experiences, i, { ...experience, ...partiel }) })
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: liste éditable sans identifiant stable
                <fieldset key={i} className="space-y-4 rounded-bouton border border-trait p-4">
                  <legend className="px-2 text-libelle font-bold text-encre-douce">
                    {experience.position.trim() || `Expérience ${i + 1}`}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Champ
                      etiquette="Poste"
                      valeur={experience.position}
                      onChange={(v) => majExperience({ position: v })}
                    />
                    <Champ
                      etiquette="Entreprise"
                      valeur={experience.company}
                      onChange={(v) => majExperience({ company: v })}
                    />
                    <Champ
                      etiquette="Dates"
                      valeur={experience.dateRange ?? ''}
                      placeholder="Ex. : 2019 – 2024"
                      onChange={(v) => majExperience({ dateRange: v })}
                    />
                    <Champ
                      etiquette="Ville"
                      valeur={experience.location ?? ''}
                      onChange={(v) => majExperience({ location: v })}
                    />
                  </div>
                  <Champ
                    etiquette="En une phrase (facultatif)"
                    multiligne
                    lignes={2}
                    valeur={experience.description ?? ''}
                    onChange={(v) => majExperience({ description: v })}
                  />
                  <Champ
                    etiquette="Ce que vous avez fait (une idée par ligne)"
                    multiligne
                    lignes={4}
                    valeur={experience.achievements.join('\n')}
                    onChange={(v) => majExperience({ achievements: lignes(v) })}
                  />
                  <Bouton
                    variante="danger"
                    taille="petit"
                    onClick={() => maj({ experiences: brouillon.experiences.filter((_, j) => j !== i) })}
                  >
                    Retirer cette expérience
                  </Bouton>
                </fieldset>
              )
            })}
            <Bouton
              variante="secondaire"
              icone="plus"
              onClick={() => maj({ experiences: [...brouillon.experiences, experienceVide()] })}
            >
              Ajouter une expérience
            </Bouton>
          </SectionRepliable>

          <SectionRepliable
            titre="Compétences et qualités"
            compte={nbCompetences}
            resume={resumeCompetences(brouillon.skills)}
          >
            <Champ
              etiquette="Vos compétences et qualités (une par ligne)"
              multiligne
              lignes={8}
              valeur={brouillon.skills.join('\n')}
              onChange={(v) => maj({ skills: lignes(v) })}
              aide="Quelques mots suffisent : « Organisation », « Travail en équipe », « Gestion des stocks »."
            />
          </SectionRepliable>

          <SectionRepliable
            titre="Formations"
            compte={brouillon.education.length}
            resume={
              brouillon.education[0]
                ? joindre(
                    brouillon.education[0].degree,
                    brouillon.education[0].school,
                    brouillon.education[0].dateRange,
                  )
                : 'Aucune formation pour l’instant'
            }
          >
            {brouillon.education.map((formation, i) => {
              const majFormation = (partiel: Partial<Education>) =>
                maj({ education: remplacer(brouillon.education, i, { ...formation, ...partiel }) })
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: liste éditable sans identifiant stable
                <fieldset key={i} className="space-y-4 rounded-bouton border border-trait p-4">
                  <legend className="px-2 text-libelle font-bold text-encre-douce">
                    {formation.degree.trim() || `Formation ${i + 1}`}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Champ
                      etiquette="Diplôme"
                      valeur={formation.degree}
                      onChange={(v) => majFormation({ degree: v })}
                    />
                    <Champ
                      etiquette="Établissement"
                      valeur={formation.school}
                      onChange={(v) => majFormation({ school: v })}
                    />
                    <Champ
                      etiquette="Année"
                      valeur={formation.dateRange ?? ''}
                      onChange={(v) => majFormation({ dateRange: v })}
                    />
                  </div>
                  <Bouton
                    variante="danger"
                    taille="petit"
                    onClick={() => maj({ education: brouillon.education.filter((_, j) => j !== i) })}
                  >
                    Retirer cette formation
                  </Bouton>
                </fieldset>
              )
            })}
            <Bouton
              variante="secondaire"
              icone="plus"
              onClick={() => maj({ education: [...brouillon.education, formationVide()] })}
            >
              Ajouter une formation
            </Bouton>
          </SectionRepliable>

          <SectionRepliable
            titre="Langues"
            compte={brouillon.languages.length}
            resume={
              brouillon.languages.length > 0
                ? brouillon.languages
                    .map((l) => (l.level ? `${l.name} : ${l.level.toLowerCase()}` : l.name))
                    .join(' · ')
                : 'Aucune langue pour l’instant'
            }
          >
            {brouillon.languages.map((langue, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: liste éditable sans identifiant stable
              <div key={i} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <Champ
                  etiquette="Langue"
                  valeur={langue.name}
                  onChange={(v) => maj({ languages: remplacer(brouillon.languages, i, { ...langue, name: v }) })}
                />
                <Selection
                  etiquette="Niveau"
                  valeur={langue.level ?? ''}
                  options={optionsNiveau(langue.level ?? '')}
                  onChange={(v) => maj({ languages: remplacer(brouillon.languages, i, { ...langue, level: v }) })}
                />
                <Bouton
                  variante="danger"
                  onClick={() => maj({ languages: brouillon.languages.filter((_, j) => j !== i) })}
                >
                  Retirer
                </Bouton>
              </div>
            ))}
            <Bouton
              variante="secondaire"
              icone="plus"
              onClick={() => maj({ languages: [...brouillon.languages, langueVide()] })}
            >
              Ajouter une langue
            </Bouton>
          </SectionRepliable>

          <SectionRepliable
            titre="Photo"
            compte="facultative"
            resume={
              brouillon.photo
                ? 'Une photo est choisie · elle reste sur votre ordinateur'
                : 'Aucune photo · elle reste sur votre ordinateur'
            }
          >
            <div className="flex flex-wrap items-center gap-5">
              {brouillon.photo ? (
                <img
                  src={brouillon.photo}
                  alt="Votre portrait"
                  className="size-24 rounded-full border border-trait object-cover"
                />
              ) : (
                <div
                  className="flex size-24 items-center justify-center rounded-full border-2 border-dashed border-trait-fort text-petit text-aide"
                  aria-hidden="true"
                >
                  Aucune
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-3">
                <input
                  ref={champPhoto}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const fichier = e.target.files?.[0]
                    e.target.value = ''
                    if (!fichier) return
                    try {
                      maj({ photo: await reduirePhoto(fichier) })
                      setErreurPhoto(null)
                    } catch (erreurLecture) {
                      setErreurPhoto(messageErreur(erreurLecture))
                    }
                  }}
                />
                <div className="flex flex-wrap gap-3">
                  <Bouton variante="secondaire" onClick={() => champPhoto.current?.click()}>
                    {brouillon.photo ? 'Changer la photo' : 'Ajouter une photo'}
                  </Bouton>
                  {brouillon.photo && (
                    <Bouton variante="danger" onClick={() => maj({ photo: undefined })}>
                      Retirer la photo
                    </Bouton>
                  )}
                </div>
                <p className="text-petit text-aide">
                  Elle apparaît seulement dans les mises en page qui en prévoient une. Elle est recadrée en carré et
                  reste sur votre ordinateur.
                </p>
                {erreurPhoto && <Alerte type="erreur">{erreurPhoto}</Alerte>}
              </div>
            </div>
          </SectionRepliable>
        </div>
      </div>

      <BarreActions
        ton="clair"
        largeur="max-w-3xl"
        gauche={
          saveStatus === 'error' ? (
            <span role="alert" className="font-bold text-erreur">
              Vos dernières corrections ne sont pas encore enregistrées. Elles le seront quand vous continuerez.
            </span>
          ) : (
            'Vos corrections sont enregistrées automatiquement.'
          )
        }
      >
        <Bouton
          taille="grand"
          iconeFin="fleche-droite"
          onClick={() => void continuer()}
          enCours={occupe === 'enregistrement'}
          desactive={occupe !== null}
        >
          Ça me va, continuer
        </Bouton>
      </BarreActions>
    </>
  )
}
