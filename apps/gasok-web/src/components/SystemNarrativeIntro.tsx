import { Link } from 'react-router-dom';

export function SystemNarrativeIntro() {
  return (
    <section className="system-narrative-intro">
      <div className="system-narrative-copy">
        <span className="tech-label">SYSTEM LAB / PROVABLE DEMONSTRATION</span>
        <h1>One economic action.<br /><span>Every boundary made visible.</span></h1>
        <p>This surface demonstrates how a proposal becomes authorised, committed, proven, and settled—while an over-limit action stops before Pact formation, wallet confirmation, or value movement.</p>
        <div><a href="#live-system-run">Run the lifecycle ↓</a><Link to="/docs/overview">Read the operating model</Link></div>
      </div>
      <div className="system-narrative-comparison">
        <article><span>PERMITTED</span><strong>420 orUSD</strong><small>ALLOW → PACT → PROOF → SETTLEMENT</small></article>
        <i />
        <article><span>BLOCKED</span><strong>1,420 orUSD</strong><small>BLOCK → NO PACT → NO WALLET → NO VALUE</small></article>
      </div>
    </section>
  );
}
