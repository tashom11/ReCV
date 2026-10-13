import { renderToStaticMarkup } from 'react-dom/server'
import { type Bloc, type CvModele, type Section, TITRES_SECTIONS } from './modele'
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

const TITRES_LATERAUX: string[] = [TITRES_SECTIONS.competences, TITRES_SECTIONS.langues]

/** Compétences en colonne étroite : « Étiquette : a, b, c » devient un sous-titre suivi d'une liste. */
function BlocLateral({ bloc }: { bloc: Bloc }) {
  if (bloc.type === 'paragraphe') {
    const separation = bloc.texte.indexOf(' : ')
    if (separation > 0) {
      const elements = bloc.texte
        .slice(separation + 3)
        .split(', ')
        .filter((e) => e.trim() !== '')
      return (
        <>
          <h3>{bloc.texte.slice(0, separation)}</h3>
          <ul>
            {elements.map((element, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
              <li key={i}>{element}</li>
            ))}
          </ul>
        </>
      )
    }
  }
  return <BlocHtml bloc={bloc} />
}

function SectionHtml({ section, lateral }: { section: Section; lateral?: boolean }) {
  return (
    <section>
      <h2>{section.titre}</h2>
      {section.blocs.map((bloc, i) =>
        lateral ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
          <BlocLateral key={i} bloc={bloc} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
          <BlocHtml key={i} bloc={bloc} />
        ),
      )}
    </section>
  )
}

export function CvHtml({ modele, idModele }: { modele: CvModele; idModele?: IdModele }) {
  const style = trouverModele(idModele)
  const contact = modele.contact.length > 0 && (
    <p className="contact">
      {modele.contact.map((element) => (
        <span key={element}>{element}</span>
      ))}
    </p>
  )
  const identite = (
    <>
      {modele.nom && <h1>{modele.nom}</h1>}
      {modele.titre && <p className="titre-poste">{modele.titre}</p>}
    </>
  )
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <title>{modele.nom ? `CV - ${modele.nom}` : 'CV'}</title>
        <style>{style.css}</style>
      </head>
      <body data-modele={style.id}>
        {style.disposition === 'lateral' ? (
          <div className="colonnes">
            <main className="principal">
              <header className="entete">
                <div className="identite">{identite}</div>
              </header>
              {modele.sections
                .filter((s) => !TITRES_LATERAUX.includes(s.titre))
                .map((section) => (
                  <SectionHtml key={section.titre} section={section} />
                ))}
            </main>
            <aside className="lateral">
              {modele.photo && <img className="photo" src={modele.photo} alt="" />}
              {contact && (
                <section>
                  <h2>Contact</h2>
                  {contact}
                </section>
              )}
              {modele.sections
                .filter((s) => TITRES_LATERAUX.includes(s.titre))
                .map((section) => (
                  <SectionHtml key={section.titre} section={section} lateral />
                ))}
            </aside>
          </div>
        ) : (
          <>
            <header className="entete">
              <div className="identite">
                {identite}
                {contact}
              </div>
              {modele.photo && <img className="photo" src={modele.photo} alt="" />}
            </header>
            {modele.sections.map((section) => (
              <SectionHtml key={section.titre} section={section} />
            ))}
          </>
        )}
      </body>
    </html>
  )
}

export function genererHtmlCv(modele: CvModele, idModele?: IdModele): string {
  return `<!doctype html>${renderToStaticMarkup(<CvHtml modele={modele} idModele={idModele} />)}`
}
