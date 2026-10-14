import { fr } from './fr'

/** Shape of a translation: the same keys as the French texts. */
export type Texts = typeof fr

/** Texts of the interface. French only for now; a language choice would select another `Texts` here. */
export const texts: Texts = fr
