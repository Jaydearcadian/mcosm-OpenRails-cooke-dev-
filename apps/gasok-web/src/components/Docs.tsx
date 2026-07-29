import { useMemo, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { defaultDoc, docCategories, docsPages } from '../content/docs';

export function Docs() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const page = docsPages.find((item) => item.slug === slug) ?? defaultDoc;
  const filtered = useMemo(() => {
    const normal = query.trim().toLowerCase();
    if (!normal) return docsPages;
    return docsPages.filter((item) => `${item.title} ${item.summary} ${item.category}`.toLowerCase().includes(normal));
  }, [query]);
  const pageIndex = docsPages.findIndex((item) => item.slug === page.slug);
  const previous = docsPages[pageIndex - 1];
  const next = docsPages[pageIndex + 1];

  return (
    <main className="docs-page">
      <aside className="docs-sidebar">
        <div className="docs-sidebar-head"><span>OPENRAILS DOCS</span><strong>OPERATING MANUAL</strong></div>
        <label><span>SEARCH</span><input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Find a concept" /></label>
        <nav aria-label="Documentation">
          {docCategories.map((category) => {
            const categoryPages = filtered.filter((item) => item.category === category);
            if (!categoryPages.length) return null;
            return <div key={category}><span>{category}</span>{categoryPages.map((item) => <button className={item.slug === page.slug ? 'active' : ''} key={item.slug} onClick={() => navigate(`/docs/${item.slug}`)}><i>{item.index}</i>{item.title}</button>)}</div>;
          })}
        </nav>
      </aside>

      <article className="docs-article">
        <div className="docs-breadcrumb"><Link to="/docs/overview">DOCS</Link><i>/</i><span>{page.category}</span><i>/</i><strong>{page.title}</strong></div>
        <header className="docs-title">
          <div className="docs-page-icon">{page.index}</div>
          <span>{page.status ?? 'REFERENCE'}</span>
          <h1>{page.title}</h1>
          <p>{page.summary}</p>
        </header>
        <div className="docs-page-properties"><div><span>SURFACE</span><strong>OPENRAILS SYSTEM</strong></div><div><span>NETWORK SCOPE</span><strong>PORTABLE</strong></div><div><span>LAST REVISION</span><strong>V5 / 2026</strong></div></div>
        {page.sections.map((section) => <section key={section.id} id={section.id} className="docs-section"><h2>{section.title}</h2>{section.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.callout && <div className="docs-callout"><span>IMPORTANT</span><strong>{section.callout}</strong></div>}{section.properties && <div className="docs-property-table">{section.properties.map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value}</span></div>)}</div>}{section.code && <pre><div><span>OPENRAILS / REFERENCE</span><button type="button" onClick={() => void navigator.clipboard?.writeText(section.code ?? '')}>COPY</button></div><code>{section.code}</code></pre>}</section>)}
        <footer className="docs-pagination">{previous ? <Link to={`/docs/${previous.slug}`}><span>← PREVIOUS</span><strong>{previous.title}</strong></Link> : <i />}{next ? <Link to={`/docs/${next.slug}`}><span>NEXT →</span><strong>{next.title}</strong></Link> : <i />}</footer>
      </article>

      <aside className="docs-toc">
        <span>ON THIS PAGE</span>
        {page.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
        <div><span>PROVENANCE</span><strong>OPENRAILS / CANONICAL</strong><small>Network evidence is labelled separately as live, recorded, or demonstration.</small></div>
      </aside>
    </main>
  );
}
