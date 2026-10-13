import type { Experience, Formation, Langue, Profil } from '@core/schemas'
import { useEffect, useRef, useState } from 'react'
import { reduirePhoto } from '../photo'
import { useProgressionTache } from '../progression'
import { Alerte, Bouton, Carte, Champ, Chargement, messageErreur, Selection, Titre } from '../ui'

const lignes = (texte: string) => texte.split('\n')
const nettoyer = (valeurs: string[]) => valeurs.map((v) => v.trim()).filter(Boolean)

// Les listes éditées gardent leurs lignes vides pendant la saisie ; on les retire à l'enregistrement.
function nettoyerProfil(profil: Profil): Profil {
  return {
    ...profil,
    liensProfessionnels: nettoyer(profil.liensProfessionnels),
    competences: nettoyer(profil.competences),
    experiences: profil.experiences.map((e) => ({ ...e, realisations: nettoyer(e.realisations) })),
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

const experienceVide = (): Experience => ({ poste: '', entreprise: '', realisations: [] })
const formationVide = (): Formation => ({ diplome: '', etablissement: '' })
const langueVide = (): Langue => ({ nom: '' })

function remplacer<T>(liste: T[], indice: number, valeur: T): T[] {
  return liste.map((element, i) => (i === indice ? valeur : element))
}

export function EcranProfil({
  profil,
  onProfil,
  onSuivant,
}: {
  profil: Profil | null
  onProfil: (profil: Profil) => void
  onSuivant: () => void
}) {
  const [brouillon, setBrouillon] = useState<Profil | null>(profil)
  const [occupe, setOccupe] = useState<'import' | 'enregistrement' | 'accroche' | null>(null)
  const progressionAccroche = useProgressionTache('accroche', occupe === 'accroche')
  const champPhoto = useRef<HTMLInputElement>(null)
  // Retour affiché sous le champ : le bandeau global est en haut de page, hors de vue quand on est au milieu du formulaire.
  const [retourAccroche, setRetourAccroche] = useState<{ type: 'erreur' | 'succes'; texte: string } | null>(null)
  const progressionImport = useProgressionTache('import', occupe === 'import')
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => setBrouillon(profil), [profil])

  const importer = async () => {
    if (
      brouillon &&
      !window.confirm(
        'Importer un autre CV remplace le profil affiché (ton ancien profil reste sauvegardé dans la base, mais n’est plus modifiable ici). Continuer ?',
      )
    ) {
      return
    }
    setOccupe('import')
    setErreur(null)
    setMessage(null)
    try {
      const resultat = await window.api.importerCv()
      if (resultat) {
        onProfil(resultat.profil)
        setMessage('CV importé. Vérifie et corrige les informations extraites ci-dessous.')
      }
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setOccupe(null)
    }
  }

  const enregistrer = async (puisContinuer = false) => {
    if (!brouillon) return
    setOccupe('enregistrement')
    setErreur(null)
    try {
      const { profil: enregistre } = await window.api.enregistrerProfil(nettoyerProfil(brouillon))
      onProfil(enregistre)
      setMessage('Profil enregistré.')
      if (puisContinuer) onSuivant()
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setOccupe(null)
    }
  }

  // Accroche générique, fondée sur les compétences transversales : valable quelle que soit l'offre visée.
  const genererAccroche = async () => {
    if (!brouillon) return
    if (
      (brouillon.accroche ?? '').trim() !== '' &&
      !window.confirm(
        'Remplacer l’accroche actuelle par une accroche générée à partir de tes compétences transversales ?',
      )
    ) {
      return
    }
    setOccupe('accroche')
    setRetourAccroche(null)
    try {
      const accroche = await window.api.genererAccroche(nettoyerProfil(brouillon))
      setBrouillon((p) => (p ? { ...p, accroche } : p))
      setRetourAccroche({
        type: 'succes',
        texte: 'Accroche générée à partir de tes compétences transversales : relis-la et ajuste-la si besoin.',
      })
    } catch (e) {
      setRetourAccroche({ type: 'erreur', texte: messageErreur(e) })
    } finally {
      setOccupe(null)
    }
  }

  const maj = (partiel: Partial<Profil>) => setBrouillon((p) => (p ? { ...p, ...partiel } : p))
  const majExperience = (i: number, partiel: Partial<Experience>, base: Experience, liste: Experience[]) =>
    maj({ experiences: remplacer(liste, i, { ...base, ...partiel }) })

  return (
    <div className="space-y-5">
      <Titre sousTitre="Importe ton CV (PDF ou DOCX) : le profil extrait reste modifiable avant toute adaptation.">
        Mon profil
      </Titre>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {message && <Alerte type="succes">{message}</Alerte>}

      <div className="flex gap-3">
        <Bouton onClick={importer} enCours={occupe === 'import'} desactive={occupe !== null}>
          {occupe === 'import' ? 'Analyse du CV en cours…' : brouillon ? 'Importer un autre CV' : 'Importer un CV'}
        </Bouton>
      </div>
      {occupe === 'import' && (
        <Chargement
          titre="Analyse de ton CV par le modèle…"
          etape={progressionImport?.etape ?? 'Lecture du fichier'}
          note="Le modèle structure ton CV (expériences, compétences, formations). Cela peut prendre une à plusieurs minutes avec un modèle local."
        />
      )}

      {brouillon && (
        <>
          <Carte titre="Photo (facultative)">
            <div className="flex items-center gap-4">
              {brouillon.photo ? (
                <img
                  src={brouillon.photo}
                  alt="Portrait choisi"
                  className="h-24 w-24 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400"
                  aria-hidden="true"
                >
                  Aucune
                </div>
              )}
              <div className="space-y-2">
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
                      setErreur(null)
                    } catch (erreurPhoto) {
                      setErreur(messageErreur(erreurPhoto))
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Bouton variante="secondaire" onClick={() => champPhoto.current?.click()}>
                    {brouillon.photo ? 'Changer la photo' : 'Ajouter une photo'}
                  </Bouton>
                  {brouillon.photo && (
                    <Bouton variante="danger" onClick={() => maj({ photo: undefined })}>
                      Retirer
                    </Bouton>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  Facultative : elle apparaît dans les modèles qui en comportent et reste sur ton ordinateur (jamais
                  envoyée au modèle de langage). Recadrée en carré. Pense à enregistrer le profil.
                </p>
              </div>
            </div>
          </Carte>

          <Carte titre="Identité">
            {(brouillon.nom ?? '').trim() !== '' && !/\s/.test((brouillon.nom ?? '').trim()) && (
              <Alerte type="avertissement">
                Un seul mot dans « Nom et prénom » : il manque peut-être ton prénom (il apparaît en tête du CV exporté).
              </Alerte>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ
                etiquette="Nom et prénom"
                valeur={brouillon.nom ?? ''}
                placeholder="Prénom NOM"
                onChange={(v) => maj({ nom: v })}
              />
              <Champ
                etiquette="Titre du poste"
                valeur={brouillon.titrePoste ?? ''}
                onChange={(v) => maj({ titrePoste: v })}
              />
              <Champ etiquette="E-mail" valeur={brouillon.email ?? ''} onChange={(v) => maj({ email: v })} />
              <Champ etiquette="Téléphone" valeur={brouillon.telephone ?? ''} onChange={(v) => maj({ telephone: v })} />
              <Champ etiquette="Adresse" valeur={brouillon.adresse ?? ''} onChange={(v) => maj({ adresse: v })} />
              <Champ
                etiquette="Liens professionnels (un par ligne)"
                multiligne
                lignes={2}
                valeur={brouillon.liensProfessionnels.join('\n')}
                onChange={(v) => maj({ liensProfessionnels: lignes(v) })}
              />
            </div>
            <Champ
              etiquette="Accroche"
              multiligne
              valeur={brouillon.accroche ?? ''}
              onChange={(v) => maj({ accroche: v })}
              action={
                <Bouton
                  variante="secondaire"
                  onClick={genererAccroche}
                  enCours={occupe === 'accroche'}
                  desactive={occupe !== null}
                >
                  {occupe === 'accroche' ? 'Génération…' : 'Générer une accroche'}
                </Bouton>
              }
            />
            <p className="text-xs text-slate-500">
              L’accroche générée repose uniquement sur tes compétences transversales (rigueur, autonomie,
              organisation…), pas sur ton métier : elle reste valable pour toutes les offres.
            </p>
            {retourAccroche && <Alerte type={retourAccroche.type}>{retourAccroche.texte}</Alerte>}
            {occupe === 'accroche' && (
              <Chargement
                titre="Génération de l’accroche…"
                etape={progressionAccroche?.etape ?? 'Repérage des compétences transversales'}
              />
            )}
          </Carte>

          <Carte titre="Expériences">
            {brouillon.experiences.map((experience, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: liste éditable sans identifiant stable
              <div key={i} className="space-y-3 rounded-md border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Champ
                    etiquette="Poste"
                    valeur={experience.poste}
                    onChange={(v) => majExperience(i, { poste: v }, experience, brouillon.experiences)}
                  />
                  <Champ
                    etiquette="Entreprise"
                    valeur={experience.entreprise}
                    onChange={(v) => majExperience(i, { entreprise: v }, experience, brouillon.experiences)}
                  />
                  <Champ
                    etiquette="Période"
                    valeur={experience.periode ?? ''}
                    onChange={(v) => majExperience(i, { periode: v }, experience, brouillon.experiences)}
                  />
                  <Champ
                    etiquette="Lieu"
                    valeur={experience.lieu ?? ''}
                    onChange={(v) => majExperience(i, { lieu: v }, experience, brouillon.experiences)}
                  />
                </div>
                <Champ
                  etiquette="Description"
                  multiligne
                  lignes={2}
                  valeur={experience.description ?? ''}
                  onChange={(v) => majExperience(i, { description: v }, experience, brouillon.experiences)}
                />
                <Champ
                  etiquette="Réalisations (une par ligne)"
                  multiligne
                  lignes={4}
                  valeur={experience.realisations.join('\n')}
                  onChange={(v) => majExperience(i, { realisations: lignes(v) }, experience, brouillon.experiences)}
                />
                <Bouton
                  variante="danger"
                  onClick={() => maj({ experiences: brouillon.experiences.filter((_, j) => j !== i) })}
                >
                  Supprimer cette expérience
                </Bouton>
              </div>
            ))}
            <Bouton
              variante="secondaire"
              onClick={() => maj({ experiences: [...brouillon.experiences, experienceVide()] })}
            >
              Ajouter une expérience
            </Bouton>
          </Carte>

          <Carte titre="Compétences">
            <Champ
              etiquette="Une par ligne"
              multiligne
              lignes={5}
              valeur={brouillon.competences.join('\n')}
              onChange={(v) => maj({ competences: lignes(v) })}
            />
          </Carte>

          <Carte titre="Formations">
            {brouillon.formations.map((formation, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: liste éditable sans identifiant stable
              <div key={i} className="grid gap-3 sm:grid-cols-3">
                <Champ
                  etiquette="Diplôme"
                  valeur={formation.diplome}
                  onChange={(v) =>
                    maj({ formations: remplacer(brouillon.formations, i, { ...formation, diplome: v }) })
                  }
                />
                <Champ
                  etiquette="Établissement"
                  valeur={formation.etablissement}
                  onChange={(v) =>
                    maj({ formations: remplacer(brouillon.formations, i, { ...formation, etablissement: v }) })
                  }
                />
                <Champ
                  etiquette="Période"
                  valeur={formation.periode ?? ''}
                  onChange={(v) =>
                    maj({ formations: remplacer(brouillon.formations, i, { ...formation, periode: v }) })
                  }
                />
              </div>
            ))}
            <Bouton
              variante="secondaire"
              onClick={() => maj({ formations: [...brouillon.formations, formationVide()] })}
            >
              Ajouter une formation
            </Bouton>
          </Carte>

          <Carte titre="Langues">
            {brouillon.langues.map((langue, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: liste éditable sans identifiant stable
              <div key={i} className="grid gap-3 sm:grid-cols-2">
                <Champ
                  etiquette="Langue"
                  valeur={langue.nom}
                  onChange={(v) => maj({ langues: remplacer(brouillon.langues, i, { ...langue, nom: v }) })}
                />
                <Selection
                  etiquette="Niveau"
                  valeur={langue.niveau ?? ''}
                  options={optionsNiveau(langue.niveau ?? '')}
                  onChange={(v) => maj({ langues: remplacer(brouillon.langues, i, { ...langue, niveau: v }) })}
                />
              </div>
            ))}
            <Bouton variante="secondaire" onClick={() => maj({ langues: [...brouillon.langues, langueVide()] })}>
              Ajouter une langue
            </Bouton>
          </Carte>

          <div className="flex gap-3">
            <Bouton onClick={() => enregistrer()} enCours={occupe === 'enregistrement'} desactive={occupe !== null}>
              {occupe === 'enregistrement' ? 'Enregistrement…' : 'Enregistrer le profil'}
            </Bouton>
            <Bouton variante="secondaire" onClick={() => enregistrer(true)} desactive={occupe !== null}>
              Enregistrer et continuer vers l’offre
            </Bouton>
          </div>
        </>
      )}
    </div>
  )
}
