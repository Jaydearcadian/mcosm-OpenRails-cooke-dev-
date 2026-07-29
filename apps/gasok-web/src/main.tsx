import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { GIWA } from './data/giwa';
import { SystemMap } from './components/SystemMap';
import './styles.css';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="control-strip">
        <Link className="brand" to="/">OPENRAILS</Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/system">SYSTEM</NavLink>
          <NavLink to="/network">NETWORK</NavLink>
          <NavLink to="/build">BUILD</NavLink>
        </nav>
        <div className="network-control"><span>GIWA / SEPOLIA</span><button>CONNECT</button></div>
      </header>
      {children}
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  return (
    <main>
      <section className="hero">
        <span className="tech-label">OPENRAILS / PROGRAMMABLE COMMERCE</span>
        <motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          Commerce is becoming programmable.<br /><span>Its authority should be too.</span>
        </motion.h1>
        <p className="hero-copy">OpenRails is the control, agreement, and settlement plane through which people, organisations, applications, and agents act on GIWA under explicit authority, commercial terms, financial limits, and accountability.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => document.getElementById('workspace')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}>Enter the system <b>↘</b></button>
          <button className="text-action" onClick={() => navigate('/network')}>View live deployment</button>
        </div>
        <div className="unbound-diagram" aria-label="Unbound economic actors">
          <span className="actor a1">ACTOR</span><span className="actor a2">APPLICATION</span><span className="actor a3">AGENT</span><span className="actor a4">COUNTERPARTY</span>
          <div className="unbound-core"><span>SYSTEM / UNBOUND</span></div>
        </div>
      </section>

      <section id="workspace" className="workspace-scene">
        <div className="workspace-copy"><span className="tech-label">WORKSPACE / ACTIVE</span><h2>Ownership becomes explicit.</h2><p>A Workspace anchors the principal, actors, agents, and economic activity before authority is delegated.</p></div>
        <div className="workspace-core" aria-label="OpenRails Workspace">
          <div className="core-layer outer"><div className="core-layer middle"><div className="core-layer inner">OPENRAILS</div></div></div>
          <span className="relation owner">OWNER / OWNS</span><span className="relation operator">OPERATOR / OPERATES</span><span className="relation agent">AGENT / ACTS FOR</span><span className="relation party">PARTY / INTERACTS WITH</span>
        </div>
        <div className="path-handoff"><span>PATH / 04</span><i /><small>ACTION · ASSET · PARTY · EXPOSURE · VELOCITY · DURATION</small></div>
      </section>
      <SystemMap />
    </main>
  );
}

function Network() {
  return <main className="page"><span className="tech-label">NETWORK / LIVE ON GIWA</span><h1>GIWA deployment ledger.</h1><div className="ledger">{Object.entries(GIWA.contracts).map(([name,address]) => <div className="ledger-row" key={name}><strong>{name}</strong><code>{address}</code><span>LIVE ON GIWA</span></div>)}</div></main>;
}

function Build() {
  return <main className="page"><span className="tech-label">BUILD / OPENRAILS RUNTIME</span><h1>Architecture for accountable programmable commerce.</h1><pre className="architecture">{`BNH Runtime\n├── Baphomet Policy Engine\n├── Action Registry\n├── Pact State Machine\n├── Verification Plugins\n├── GIWA Observer\n└── Gaia`}</pre></main>;
}

function App() {
  return <Shell><Routes><Route path="/" element={<Hero />} /><Route path="/system" element={<main className="page"><SystemMap /></main>} /><Route path="/network" element={<Network />} /><Route path="/build" element={<Build />} /></Routes></Shell>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
