import { Link } from 'react-router-dom';
import { GIWA } from '../data/giwa';

const lifecycle = ['OWN', 'AUTHORISE', 'COMMIT', 'PROVE', 'SETTLE', 'RESOLVE'];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-rail" aria-label="OpenRails lifecycle">
        {lifecycle.map((item, index) => (
          <div key={item} className="footer-rail-step">
            <span>0{index + 1}</span><strong>{item}</strong>{index < lifecycle.length - 1 && <i />}
          </div>
        ))}
      </div>
      <div className="footer-main">
        <div className="footer-statement">
          <span className="tech-label">OPENRAILS / COMPLETE SYSTEM</span>
          <h2>Authority made explicit.<br />Settlement made accountable.</h2>
          <p>Programmable settlement infrastructure for machine commerce—extended with explicit authority, agreement, evidence, and resolution.</p>
        </div>
        <div className="footer-links">
          <div><span>SYSTEM</span><Link to="/system">System Lab</Link><Link to="/docs/workspace-path">Workspace & Path</Link><Link to="/docs/pact">Pact</Link><Link to="/docs/proof-gaia">Proof & Gaia</Link></div>
          <div><span>BUILD</span><Link to="/build">Architecture</Link><Link to="/docs/agent-kernel">Agent Kernel</Link><Link to="/docs/railsflow">RailsFlow</Link><Link to="/docs/security">Security</Link></div>
          <div><span>REFERENCE</span><Link to="/docs/overview">Documentation</Link><Link to="/docs/networks">Network adapters</Link><Link to="/network">GIWA deployment</Link><a href={GIWA.explorerUrl} target="_blank" rel="noreferrer">Explorer ↗</a></div>
        </div>
      </div>
      <div className="footer-status">
        <span>GIWA SEPOLIA / CHAIN {GIWA.chainId}</span>
        <span><i /> SYSTEM STATUS / OPERATIONAL</span>
        <span>OPENRAILS / 2026</span>
      </div>
    </footer>
  );
}
