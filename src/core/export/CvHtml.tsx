import { renderToStaticMarkup } from 'react-dom/server'
import { type Block, CV_LABELS, type CvDocument, type Section, type SectionId } from './cvDocument'
import { findTemplate, type TemplateId } from './templates'

// ATS layout: a single column, real text, no table nor icon, standard section titles.
// The style comes from the chosen template (see templates.ts); the structure is the same for all.

function BlockHtml({ block }: { block: Block }) {
  switch (block.type) {
    case 'paragraph':
      return <p>{block.text}</p>
    case 'labelled-list':
      // A label then a list, laid out in columns by the template: scannable by a recruiter, plain text for an ATS.
      return (
        <>
          <h3>{block.label}</h3>
          <ul className="competences">
            {block.elements.map((element, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static rendering, fixed order
              <li key={i}>{element}</li>
            ))}
          </ul>
        </>
      )
    case 'list':
      return (
        <ul>
          {block.elements.map((element, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static rendering, fixed order
            <li key={i}>{element}</li>
          ))}
        </ul>
      )
    case 'entry':
      return (
        <div>
          <h3>{block.heading}</h3>
          {(block.subtitle || block.dateRange) && (
            <p className="meta">{[block.subtitle, block.dateRange].filter(Boolean).join(' | ')}</p>
          )}
          {block.bullets.length > 0 && (
            <ul>
              {block.bullets.map((bullet, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static rendering, fixed order
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      )
  }
}

const SIDEBAR_SECTIONS: SectionId[] = ['skills', 'languages']

/** In a narrow column, a labelled list becomes a subtitle followed by a list. */
function SidebarBlock({ block }: { block: Block }) {
  if (block.type !== 'labelled-list') return <BlockHtml block={block} />
  return (
    <>
      <h3>{block.label}</h3>
      <ul>
        {block.elements.map((element, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static rendering, fixed order
          <li key={i}>{element}</li>
        ))}
      </ul>
    </>
  )
}

function SectionHtml({ section, sidebar }: { section: Section; sidebar?: boolean }) {
  return (
    <section>
      <h2>{section.title}</h2>
      {section.blocks.map((block, i) =>
        sidebar ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static rendering, fixed order
          <SidebarBlock key={i} block={block} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static rendering, fixed order
          <BlockHtml key={i} block={block} />
        ),
      )}
    </section>
  )
}

export function CvHtml({ model, templateId }: { model: CvDocument; templateId?: TemplateId }) {
  const style = findTemplate(templateId)
  const { language } = model
  const inSidebar = (s: Section) => SIDEBAR_SECTIONS.includes(s.id)
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
    <html lang={language}>
      <head>
        <meta charSet="utf-8" />
        <title>{model.name ? `CV - ${model.name}` : 'CV'}</title>
        <style>{style.css}</style>
      </head>
      <body data-template={style.id}>
        {style.layout === 'sidebar' ? (
          <div className="colonnes">
            <main className="principal">
              <header className="entete">
                <div className="identite">{identity}</div>
              </header>
              {model.sections
                .filter((s) => !inSidebar(s))
                .map((section) => (
                  <SectionHtml key={section.id} section={section} />
                ))}
            </main>
            <aside className="lateral">
              {model.photo && <img className="photo" src={model.photo} alt="" />}
              {contact && (
                <section>
                  <h2>{CV_LABELS[language].contact}</h2>
                  {contact}
                </section>
              )}
              {model.sections.filter(inSidebar).map((section) => (
                <SectionHtml key={section.id} section={section} sidebar />
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
              <SectionHtml key={section.id} section={section} />
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
