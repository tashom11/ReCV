import { type ActionErreur, type DescriptionErreur, LIBELLES_ACTIONS } from '../erreurs'
import { Alerte } from './Alerte'
import { Bouton } from './Bouton'

/**
 * Affiche un problème décrit par `decrireErreur` : titre, explication, actions (la première est conseillée).
 * Le message technique reste replié dans « Détails ».
 */
export function AlerteErreur({
  description,
  surAction,
  libelles,
  headingLevel,
}: {
  description: DescriptionErreur
  surAction: (action: ActionErreur) => void
  /** Libellés propres à l'écran, quand ceux par défaut ne conviennent pas. */
  libelles?: Partial<Record<ActionErreur, string>>
  headingLevel?: 2 | 3
}) {
  return (
    <Alerte
      headingLevel={headingLevel}
      type={description.type}
      icone={description.icone}
      titre={description.titre}
      actions={
        description.actions.length > 0 &&
        description.actions.map((action, i) => (
          <Bouton
            key={action}
            taille="petit"
            variante={i === 0 ? 'principal' : 'secondaire'}
            onClick={() => surAction(action)}
          >
            {libelles?.[action] ??
              (i === 0 ? LIBELLES_ACTIONS[action] : LIBELLES_ACTIONS[action].replace(' à la place', ''))}
          </Bouton>
        ))
      }
    >
      <p>{description.texte}</p>
      {description.details && (
        <details className="pt-1">
          <summary className="inline-flex min-h-11 items-center font-bold text-marque underline underline-offset-4">
            Détails
          </summary>
          <p className="rounded-champ bg-surface/70 p-3 font-mono text-petit break-words text-encre-douce">
            {description.details}
          </p>
        </details>
      )}
    </Alerte>
  )
}
