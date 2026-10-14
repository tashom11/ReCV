import { genererAccrocheProfil } from '../adaptation/accrocheProfil'
import { type AnalyseOffre, analyserOffre } from '../adaptation/motsCles'
import { adapterCv } from '../adaptation/pipeline'
import type { JobPosting, Profile, TailoredCv } from '../schemas'
import { extraireOffre, extraireProfil } from './extraction'
import type { FournisseurLLM, OptionsAdaptation } from './fournisseur'
import type { MoteurLLM } from './moteur'

// Implémentation commune à Ollama, API (BYOK) et modèle local : seul le moteur change.
export class FournisseurStructure implements FournisseurLLM {
  constructor(private readonly moteur: MoteurLLM) {}

  extraireProfil(texteCv: string): Promise<Profile> {
    return extraireProfil(this.moteur, texteCv)
  }

  extraireOffre(texteOffre: string): Promise<JobPosting> {
    return extraireOffre(this.moteur, texteOffre)
  }

  analyserOffre(offre: JobPosting): Promise<AnalyseOffre> {
    return analyserOffre(this.moteur, offre)
  }

  adapterCv(profil: Profile, offre: JobPosting, options?: OptionsAdaptation): Promise<TailoredCv> {
    return adapterCv(this.moteur, profil, offre, options)
  }

  genererAccroche(profil: Profile): Promise<string> {
    return genererAccrocheProfil(this.moteur, profil)
  }

  modeCalcul(): 'gpu' | 'cpu' | null {
    return this.moteur.modeCalcul?.() ?? null
  }

  async liberer(): Promise<void> {
    await this.moteur.liberer?.()
  }
}
