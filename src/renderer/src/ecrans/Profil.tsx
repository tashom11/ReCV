import type { Experience, Formation, Langue, Profil } from '@core/schemas'
import { useEffect, useState } from 'react'
import { Alerte, Bouton, Carte, Champ, messageErreur, Titre } from '../ui'

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
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => setBrouillon(profil), [profil])

  const importer = async () => {
    setOccupe(true)
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
      setOccupe(false)
    }
  }

  const enregistrer = async (puisContinuer = false) => {
    if (!brouillon) return
    setOccupe(true)
    setErreur(null)
    try {
      const { profil: enregistre } = await window.api.enregistrerProfil(nettoyerProfil(brouillon))
      onProfil(enregistre)
      setMessage('Profil enregistré.')
      if (puisContinuer) onSuivant()
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setOccupe(false)
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
        <Bouton onClick={importer} desactive={occupe}>
          {occupe ? 'Analyse en cours…' : brouillon ? 'Importer un autre CV' : 'Importer un CV'}
        </Bouton>
      </div>

      {brouillon && (
        <>
          <Carte titre="Identité">
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ etiquette="Nom" valeur={brouillon.nom ?? ''} onChange={(v) => maj({ nom: v })} />
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
            />
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
                <Champ
                  etiquette="Niveau"
                  valeur={langue.niveau ?? ''}
                  onChange={(v) => maj({ langues: remplacer(brouillon.langues, i, { ...langue, niveau: v }) })}
                />
              </div>
            ))}
            <Bouton variante="secondaire" onClick={() => maj({ langues: [...brouillon.langues, langueVide()] })}>
              Ajouter une langue
            </Bouton>
          </Carte>

          <div className="flex gap-3">
            <Bouton onClick={() => enregistrer()} desactive={occupe}>
              Enregistrer le profil
            </Bouton>
            <Bouton variante="secondaire" onClick={() => enregistrer(true)} desactive={occupe}>
              Enregistrer et continuer vers l’offre
            </Bouton>
          </div>
        </>
      )}
    </div>
  )
}
