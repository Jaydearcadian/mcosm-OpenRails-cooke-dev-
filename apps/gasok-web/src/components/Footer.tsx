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
          <span className="tech-label">OPENRAILS / GIWA</span>
          <h2>Authority made explicit.<br />Settlement made accountable.</h2>
          <p>The control, agreement, and settlement plane for programmable commerce on GIWA.</p>
        </div>
        <div className="footer-links">
          <div><span>SYSTEM</span><Link to="/system">Workspace</Link><Link to="/system">Path</Link><Link to="/system">Pact</Link><Link to="/system">Proof</Link><Link to="/system">Gaia</Link></div>
          <div><span>BUILD</span><Link to="/build">Runtime</Link><Link to="/build">SDK</Link><Link to="/build">MCP</Link><Link to="/build">Telegram</Link></div>
          <div><span>GIWA</span><Link to="/network">Network status</Link><Link to="/network">Contracts</Link><a href={GIWA.explorerUrl} target="_blank" rel="noreferrer">Explorer ↗</a></div>
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
