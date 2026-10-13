import { renderToStaticMarkup } from 'react-dom/server'
import type { Bloc, CvModele } from './modele'
import { type IdModele, trouverModele } from './modeles'

// Mise en page ATS : une seule colonne, texte réel, pas de tableau ni d'icône, titres de section standards.
// Le style vient du modèle choisi (voir modeles.ts) ; la structure est identique pour tous.

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

export function CvHtml({ modele, idModele }: { modele: CvModele; idModele?: IdModele }) {
  const style = trouverModele(idModele)
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <title>{modele.nom ? `CV - ${modele.nom}` : 'CV'}</title>
        <style>{style.css}</style>
      </head>
      <body data-modele={style.id}>
        <header className="entete">
          <div className="identite">
            {modele.nom && <h1>{modele.nom}</h1>}
            {modele.titre && <p className="titre-poste">{modele.titre}</p>}
            {modele.contact.length > 0 && <p className="contact">{modele.contact.join(' | ')}</p>}
          </div>
          {modele.photo && <img className="photo" src={modele.photo} alt="" />}
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

export function genererHtmlCv(modele: CvModele, idModele?: IdModele): string {
  return `<!doctype html>${renderToStaticMarkup(<CvHtml modele={modele} idModele={idModele} />)}`
}
