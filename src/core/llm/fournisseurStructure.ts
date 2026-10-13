import { adapterCv } from '../adaptation/pipeline'
import type { CvAdapte, Offre, Profil } from '../schemas'
import { extraireOffre, extraireProfil } from './extraction'
import type { FournisseurLLM, OptionsAdaptation } from './fournisseur'
import type { MoteurLLM } from './moteur'

// Implémentation commune à Ollama, API (BYOK) et modèle local : seul le moteur change.
export class FournisseurStructure implements FournisseurLLM {
  constructor(private readonly moteur: MoteurLLM) {}

  extraireProfil(texteCv: string): Promise<Profil> {
    return extraireProfil(this.moteur, texteCv)
  }

  extraireOffre(texteOffre: string): Promise<Offre> {
    return extraireOffre(this.moteur, texteOffre)
  }

  adapterCv(profil: Profil, offre: Offre, options?: OptionsAdaptation): Promise<CvAdapte> {
    return adapterCv(this.moteur, profil, offre, options)
  }

  async liberer(): Promise<void> {
    await this.moteur.liberer?.()
  }
}
