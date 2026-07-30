import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { defaultDoc, docCategories, docsPages } from '../content/docs';
import { operatingModels } from '../content/operatingModels';
import { DocsDiagram } from './DocsDiagram';

const sectionToneLabel = {
  runtime: 'RUNTIME',
  wallet: 'WALLET',
  network: 'NETWORK',
  exception: 'EXCEPTION',
} as const;

export function Docs() {
  const { slug } = useParams();
  const [query, setQuery] = useState('');
  const articleRef = useRef<HTMLElement | null>(null);
  const page = docsPages.find((item) => item.slug === slug) ?? defaultDoc;
  const operating = operatingModels[page.slug];
  const filtered = useMemo(() => {
    const normal = query.trim().toLowerCase();
    if (!normal) return docsPages;
    return docsPages.filter((item) => `${item.title} ${item.summary} ${item.oneSentence} ${item.category}`.toLowerCase().includes(normal));
  }, [query]);
  const pageIndex = docsPages.findIndex((item) => item.slug === page.slug);
  const previous = docsPages[pageIndex - 1];
  const next = docsPages[pageIndex + 1];
  const generatedSections = operating ? ['object-model', 'state-model', 'failure-model', 'worked-example', 'implementation-reference'] : [];
  const tocSections = [...page.sections.map((section) => ({ id: section.id, title: section.title })),
    ...generatedSections.map((id) => ({
      id,
      title: id === 'object-model' ? 'Object model' : id === 'state-model' ? 'State and execution model' : id === 'failure-model' ? 'Failure and recovery' : id === 'worked-example' ? 'Worked example' : 'Implementation reference',
    }))];
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeSection, setActiveSection] = useState(tocSections[0]?.id ?? '');

  const updateArticleState = () => {
    const article = articleRef.current;
    if (!article) return;
    const max = Math.max(1, article.scrollHeight - article.clientHeight);
    setReadingProgress(Math.max(0, Math.min(1, article.scrollTop / max)));
    const threshold = article.scrollTop + 150;
    let current = tocSections[0]?.id ?? '';
    for (const section of tocSections) {
      const element = article.querySelector<HTMLElement>(`#${section.id}`);
      if (element && element.offsetTop <= threshold) current = section.id;
    }
    setActiveSection(current);
  };

  const scrollToSection = (id: string) => {
    const article = articleRef.current;
    const element = article?.querySelector<HTMLElement>(`#${id}`);
    if (!article || !element) return;
    article.scrollTo({ top: Math.max(0, element.offsetTop - 24), behavior: 'smooth' });
    window.history.replaceState(null, '', `${window.location.pathname}#${id}`);
  };

  useLayoutEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    article.scrollTop = 0;
    setReadingProgress(0);
    setActiveSection(tocSections[0]?.id ?? '');
    const frame = window.requestAnimationFrame(() => {
      article.scrollTop = 0;
      const hash = window.location.hash.slice(1);
      if (hash) scrollToSection(hash);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [page.slug]);

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

      <article id="docs-scroll-region" data-route-scroll ref={articleRef} onScroll={updateArticleState} className="docs-article">
        <div className="docs-breadcrumb"><Link to="/">OPENRAILS</Link><i>/</i><Link to="/docs/overview">DOCS</Link><i>/</i><span>{page.category}</span><i>/</i><strong>{page.title}</strong></div>
        <header className="docs-title">
          <div className="docs-page-icon">{page.index}</div>
          <span>{page.status ?? 'REFERENCE'}</span>
          <h1>{page.title}</h1>
          <p>{page.summary}</p>
        </header>
        <div className="docs-page-properties"><div><span>SURFACE</span><strong>OPENRAILS SYSTEM</strong></div><div><span>NETWORK SCOPE</span><strong>PORTABLE</strong></div><div><span>REVISION</span><strong>V5.2 / 2026</strong></div></div>
        <section className="docs-quick-model" aria-label="Primitive summary">
          <div><span>IN ONE SENTENCE</span><strong>{page.oneSentence}</strong></div>
          <div><span>CREATES</span><p>{page.creates}</p></div>
          <div><span>DOES NOT</span><p>{page.doesNot}</p></div>
        </section>

        {page.sections.map((section) => <section key={section.id} id={section.id} className="docs-section"><h2>{section.title}</h2>{section.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.diagram && <DocsDiagram kind={section.diagram} caption={section.diagramCaption} />}{section.callout && <div className="docs-callout"><span>IMPORTANT</span><strong>{section.callout}</strong></div>}{section.properties && <div className="docs-property-table">{section.properties.map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value}</span></div>)}</div>}{section.code && <pre><div><span>OPENRAILS / REFERENCE</span><button type="button" onClick={() => void navigator.clipboard?.writeText(section.code ?? '')}>COPY</button></div><code>{section.code}</code></pre>}</section>)}

        {operating && <>
          <section id="object-model" className="docs-section docs-generated-section"><span className="docs-section-kicker">OPERATING DETAIL / OBJECT MODEL</span><h2>Object model</h2><p>These fields are the minimum concepts a builder, operator, or reviewer should be able to inspect when working with {page.title}.</p><div className="docs-field-grid">{operating.fields.map(([label, value], index) => <div key={label}><i>{String(index + 1).padStart(2, '0')}</i><strong>{label}</strong><span>{value}</span></div>)}</div></section>

          <section id="state-model" className="docs-section docs-generated-section"><span className="docs-section-kicker">OPERATING DETAIL / EXECUTION</span><h2>State and execution model</h2><p>The lifecycle separates Runtime preparation, wallet authority, network execution, and exception handling. No stage silently assumes the authority of another.</p><div className="docs-state-flow">{operating.flow.map(([state, description, tone], index) => <div className={`docs-state-step ${tone}`} key={`${state}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{sectionToneLabel[tone]}</b><strong>{state}</strong><p>{description}</p></div>{index < operating.flow.length - 1 && <i aria-hidden="true">↓</i>}</div>)}</div></section>

          <section id="failure-model" className="docs-section docs-generated-section"><span className="docs-section-kicker">OPERATING DETAIL / FAILURE</span><h2>Failure and recovery</h2><p>Failures should remain explicit. The system must expose what stopped, what did not happen, and which safe action can move the lifecycle forward.</p><div className="docs-failure-table"><div className="head"><span>TRIGGER</span><span>OUTCOME</span><span>SAFE RECOVERY</span></div>{operating.failures.map(([trigger, outcome, recovery]) => <div key={trigger}><strong>{trigger}</strong><span>{outcome}</span><span>{recovery}</span></div>)}</div></section>

          <section id="worked-example" className="docs-section docs-generated-section"><span className="docs-section-kicker">OPERATING DETAIL / CANONICAL EXAMPLE</span><h2>{operating.example.title}</h2><div className="docs-example"><p>{operating.example.context}</p><ol>{operating.example.steps.map((step) => <li key={step}>{step}</li>)}</ol><div><span>RESULT</span><strong>{operating.example.result}</strong></div></div></section>

          <section id="implementation-reference" className="docs-section docs-generated-section"><span className="docs-section-kicker">OPERATING DETAIL / BUILD</span><h2>Implementation reference</h2><p>These references connect the explanation to the current OpenRails codebase, Runtime interface, or live product surface.</p><div className="docs-reference-grid">{operating.references.map((reference) => reference.href ? <Link key={`${reference.kind}-${reference.value}`} to={reference.href}><span>{reference.kind}</span><strong>{reference.label}</strong><code>{reference.value}</code><b>↗</b></Link> : <div key={`${reference.kind}-${reference.value}`}><span>{reference.kind}</span><strong>{reference.label}</strong><code>{reference.value}</code></div>)}</div></section>
        </>}

        <section className="docs-operate-link"><span>FROM EXPLANATION TO PROOF</span><h2>Inspect these objects inside the System Lab.</h2><p>The documentation explains the model. The System Lab shows the objects, decisions, signatures, and receipts in one guided lifecycle.</p><Link to="/system#live-system-run">Enter the System Lab <b>→</b></Link></section>
        <footer className="docs-pagination">{previous ? <Link to={`/docs/${previous.slug}`}><span>← PREVIOUS</span><strong>{previous.title}</strong></Link> : <i />}{next ? <Link to={`/docs/${next.slug}`}><span>NEXT →</span><strong>{next.title}</strong></Link> : <i />}</footer>
      </article>

      <aside className="docs-toc">
        <span>ON THIS PAGE</span>
        {tocSections.map((section) => <button className={activeSection === section.id ? 'active' : ''} type="button" key={section.id} onClick={() => scrollToSection(section.id)}>{section.title}</button>)}
        <div><span>PROVENANCE</span><strong>OPENRAILS / CANONICAL</strong><small>Network evidence is labelled separately as live, recorded, or demonstration.</small></div>
      </aside>
    </main>
  );
}
