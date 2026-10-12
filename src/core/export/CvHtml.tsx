import { renderToStaticMarkup } from 'react-dom/server'
import type { Bloc, CvModele } from './modele'

// Mise en page ATS : une seule colonne, texte réel, pas de tableau, d'image ni d'icône,
// titres de section standards, police système.
const STYLE = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.4; color: #111; margin: 0; }
  h1 { font-size: 20pt; margin: 0; }
  .titre-poste { font-size: 12pt; margin: 2pt 0 0; }
  .contact { margin: 4pt 0 0; color: #333; }
  h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #111; margin: 14pt 0 6pt; padding-bottom: 2pt; }
  h3 { font-size: 10.5pt; margin: 8pt 0 0; }
  .meta { color: #333; margin: 0; }
  ul { margin: 3pt 0 0; padding-left: 16pt; }
  p { margin: 0; }
`

function BlocHtml({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case 'paragraphe':
      return <p>{bloc.texte}</p>
    case 'liste':
      return (
        <ul>
          {bloc.elements.map((element, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
            <li key={i}>{element}</li>
          ))}
        </ul>
      )
    case 'entree':
      return (
        <div>
          <h3>{bloc.intitule}</h3>
          {(bloc.sousTitre || bloc.periode) && (
            <p className="meta">{[bloc.sousTitre, bloc.periode].filter(Boolean).join(' | ')}</p>
          )}
          {bloc.points.length > 0 && (
            <ul>
              {bloc.points.map((point, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
                <li key={i}>{point}</li>
              ))}
            </ul>
          )}
        </div>
      )
  }
}

export function CvHtml({ modele }: { modele: CvModele }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <title>{modele.nom ? `CV - ${modele.nom}` : 'CV'}</title>
        <style>{STYLE}</style>
      </head>
      <body>
        <header>
          {modele.nom && <h1>{modele.nom}</h1>}
          {modele.titre && <p className="titre-poste">{modele.titre}</p>}
          {modele.contact.length > 0 && <p className="contact">{modele.contact.join(' | ')}</p>}
        </header>
        {modele.sections.map((section) => (
          <section key={section.titre}>
            <h2>{section.titre}</h2>
            {section.blocs.map((bloc, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
              <BlocHtml key={i} bloc={bloc} />
            ))}
          </section>
        ))}
      </body>
    </html>
  )
}

export function genererHtmlCv(modele: CvModele): string {
  return `<!doctype html>${renderToStaticMarkup(<CvHtml modele={modele} />)}`
}
