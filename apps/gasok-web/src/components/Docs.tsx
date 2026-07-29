import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { defaultDoc, docCategories, docsPages } from '../content/docs';
import { DocsDiagram } from './DocsDiagram';

export function Docs() {
  const { slug } = useParams();
  const [query, setQuery] = useState('');
  const articleRef = useRef<HTMLElement | null>(null);
  const page = docsPages.find((item) => item.slug === slug) ?? defaultDoc;
  const filtered = useMemo(() => {
    const normal = query.trim().toLowerCase();
    if (!normal) return docsPages;
    return docsPages.filter((item) => `${item.title} ${item.summary} ${item.oneSentence} ${item.category}`.toLowerCase().includes(normal));
  }, [query]);
  const pageIndex = docsPages.findIndex((item) => item.slug === page.slug);
  const previous = docsPages[pageIndex - 1];
  const next = docsPages[pageIndex + 1];
  const [readingProgress, setReadingProgress] = useState(0);
  const { scrollYProgress } = useScroll({ target: articleRef, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (value) => setReadingProgress(Math.max(0, Math.min(1, value))));

  useEffect(() => {
    setQuery('');
    document.title = `${page.title} | OpenRails Docs`;
    return () => { document.title = 'OpenRails'; };
  }, [page.slug, page.title]);

  return (
    <main className="docs-page" data-doc={page.slug}>
      <motion.div className="docs-reading-progress" aria-hidden="true" style={{ scaleX: readingProgress }} />
      <aside className="docs-sidebar">
        <Link className="docs-sidebar-head" to="/docs/overview"><span>OPENRAILS DOCS</span><strong>OPERATING MANUAL</strong></Link>
        <label><span>SEARCH</span><input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Find a concept" /></label>
        <nav aria-label="Documentation">
          {docCategories.map((category) => {
            const categoryPages = filtered.filter((item) => item.category === category);
            if (!categoryPages.length) return null;
            return <div key={category}><span>{category}</span>{categoryPages.map((item) => <Link className={`docs-nav-link ${item.slug === page.slug ? 'active' : ''}`} key={item.slug} to={`/docs/${item.slug}`}><i>{item.index}</i><span>{item.title}</span></Link>)}</div>;
          })}
        </nav>
      </aside>

      <article ref={articleRef} key={page.slug} className="docs-article">
        <div className="docs-breadcrumb"><Link to="/">OPENRAILS</Link><i>/</i><Link to="/docs/overview">DOCS</Link><i>/</i><span>{page.category}</span><i>/</i><strong>{page.title}</strong></div>
        <header className="docs-title">
          <div className="docs-page-icon">{page.index}</div>
          <span>{page.status ?? 'REFERENCE'}</span>
          <h1>{page.title}</h1>
          <p>{page.summary}</p>
        </header>
        <div className="docs-page-properties"><div><span>SURFACE</span><strong>OPENRAILS SYSTEM</strong></div><div><span>NETWORK SCOPE</span><strong>PORTABLE</strong></div><div><span>REVISION</span><strong>V5.1 / 2026</strong></div></div>
        <section className="docs-quick-model" aria-label="Primitive summary">
          <div><span>IN ONE SENTENCE</span><strong>{page.oneSentence}</strong></div>
          <div><span>CREATES</span><p>{page.creates}</p></div>
          <div><span>DOES NOT</span><p>{page.doesNot}</p></div>
        </section>
        {page.sections.map((section) => <section key={section.id} id={section.id} className="docs-section"><h2>{section.title}</h2>{section.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.diagram && <DocsDiagram kind={section.diagram} caption={section.diagramCaption} />}{section.callout && <div className="docs-callout"><span>IMPORTANT</span><strong>{section.callout}</strong></div>}{section.properties && <div className="docs-property-table">{section.properties.map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value}</span></div>)}</div>}{section.code && <pre><div><span>OPENRAILS / REFERENCE</span><button type="button" onClick={() => void navigator.clipboard?.writeText(section.code ?? '')}>COPY</button></div><code>{section.code}</code></pre>}</section>)}
        <section className="docs-operate-link"><span>FROM EXPLANATION TO PROOF</span><h2>Inspect these objects inside the System Lab.</h2><p>The documentation explains the model. The System Lab shows the objects, decisions, signatures, and receipts in one guided lifecycle.</p><Link to="/system">Enter the System Lab <b>→</b></Link></section>
        <footer className="docs-pagination">{previous ? <Link to={`/docs/${previous.slug}`}><span>← PREVIOUS</span><strong>{previous.title}</strong></Link> : <i />}{next ? <Link to={`/docs/${next.slug}`}><span>NEXT →</span><strong>{next.title}</strong></Link> : <i />}</footer>
      </article>

      <aside key={`toc-${page.slug}`} className="docs-toc">
        <span>ON THIS PAGE</span>
        {page.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
        <div><span>PROVENANCE</span><strong>OPENRAILS / CANONICAL</strong><small>Network evidence is labelled separately as live, recorded, or demonstration.</small></div>
      </aside>
    </main>
  );
}
