import { renderToStaticMarkup } from 'react-dom/server'
import { type Block, type CvDocument, SECTION_TITLES, type Section } from './cvDocument'
import { findTemplate, type TemplateId } from './templates'

// ATS layout: a single column, real text, no table nor icon, standard section titles.
// The style comes from the chosen template (see templates.ts); the structure is the same for all.

function BlockHtml({ block }: { block: Block }) {
  switch (block.type) {
    case 'paragraphe':
      return <p>{block.text}</p>
    case 'liste':
      return (
        <ul>
          {block.elements.map((element, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
            <li key={i}>{element}</li>
          ))}
        </ul>
      )
    case 'entree':
      return (
        <div>
          <h3>{block.heading}</h3>
          {(block.subtitle || block.dateRange) && (
            <p className="meta">{[block.subtitle, block.dateRange].filter(Boolean).join(' | ')}</p>
          )}
          {block.bullets.length > 0 && (
            <ul>
              {block.bullets.map((bullet, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      )
  }
}

const SIDEBAR_TITLES: string[] = [SECTION_TITLES.skills, SECTION_TITLES.languages]

/** Skills in a narrow column: « Étiquette : a, b, c » becomes a subtitle followed by a list. */
function SidebarBlock({ block }: { block: Block }) {
  if (block.type === 'paragraphe') {
    const separation = block.text.indexOf(' : ')
    if (separation > 0) {
      const elements = block.text
        .slice(separation + 3)
        .split(', ')
        .filter((e) => e.trim() !== '')
      return (
        <>
          <h3>{block.text.slice(0, separation)}</h3>
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
  return <BlockHtml block={block} />
}

function SectionHtml({ section, sidebar }: { section: Section; sidebar?: boolean }) {
  return (
    <section>
      <h2>{section.title}</h2>
      {section.blocks.map((block, i) =>
        sidebar ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
          <SidebarBlock key={i} block={block} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: rendu statique, ordre fixe
          <BlockHtml key={i} block={block} />
        ),
      )}
    </section>
  )
}

export function CvHtml({ model, templateId }: { model: CvDocument; templateId?: TemplateId }) {
  const style = findTemplate(templateId)
  const contact = model.contact.length > 0 && (
    <p className="contact">
      {model.contact.map((element) => (
        <span key={element}>{element}</span>
      ))}
    </p>
  )
  const identity = (
    <>
      {model.name && <h1>{model.name}</h1>}
      {model.title && <p className="titre-poste">{model.title}</p>}
    </>
  )
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <title>{model.name ? `CV - ${model.name}` : 'CV'}</title>
        <style>{style.css}</style>
      </head>
      <body data-modele={style.id}>
        {style.layout === 'lateral' ? (
          <div className="colonnes">
            <main className="principal">
              <header className="entete">
                <div className="identite">{identity}</div>
              </header>
              {model.sections
                .filter((s) => !SIDEBAR_TITLES.includes(s.title))
                .map((section) => (
                  <SectionHtml key={section.title} section={section} />
                ))}
            </main>
            <aside className="lateral">
              {model.photo && <img className="photo" src={model.photo} alt="" />}
              {contact && (
                <section>
                  <h2>Contact</h2>
                  {contact}
                </section>
              )}
              {model.sections
                .filter((s) => SIDEBAR_TITLES.includes(s.title))
                .map((section) => (
                  <SectionHtml key={section.title} section={section} sidebar />
                ))}
            </aside>
          </div>
        ) : (
          <>
            <header className="entete">
              <div className="identite">
                {identity}
                {contact}
              </div>
              {model.photo && <img className="photo" src={model.photo} alt="" />}
            </header>
            {model.sections.map((section) => (
              <SectionHtml key={section.title} section={section} />
            ))}
          </>
        )}
      </body>
    </html>
  )
}

export function generateHtmlCv(model: CvDocument, templateId?: TemplateId): string {
  return `<!doctype html>${renderToStaticMarkup(<CvHtml model={model} templateId={templateId} />)}`
}
