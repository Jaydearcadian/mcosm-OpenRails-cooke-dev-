import { useState } from 'react';

type Mode = 'PERMITTED' | 'BLOCKED' | 'RECTIFIED';

const modeCopy: Record<Mode, string> = {
  PERMITTED: 'Authority passed. Commitment verified. Settlement confirmed.',
  BLOCKED: 'Proposal exceeded delegated authority. No Pact formed. No value moved.',
  RECTIFIED: 'A disputed checkpoint entered Gaia and closed through bounded rectification.',
};

const nodes = ['WORKSPACE / 01', 'PATH / 04', 'PROPOSAL / 018', 'BAPHOMET', 'PACT / 2048', 'PROOF / 02 OF 03', 'SETTLEMENT', 'GIWA RECEIPT'];

export function SystemMap() {
  const [mode, setMode] = useState<Mode>('PERMITTED');

  return (
    <section className="system-section" aria-labelledby="system-title">
      <div className="section-heading">
        <span className="tech-label">OPENRAILS / SYSTEM 01</span>
        <h2 id="system-title">From delegated authority to accountable settlement.</h2>
        <p>{modeCopy[mode]}</p>
      </div>

      <div className="mode-switch" aria-label="Lifecycle demonstration mode">
        {(['PERMITTED', 'BLOCKED', 'RECTIFIED'] as const).map((item, index) => (
          <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>
            <span>0{index + 1}</span> {item}
          </button>
        ))}
      </div>

      <div className={`system-map mode-${mode.toLowerCase()}`}>
        <div className="actors" aria-label="Workspace actors">
          <span>OWNER</span><span>OPERATOR</span><span>AGENT</span>
        </div>
        <div className="lifecycle">
          {nodes.map((node, index) => (
            <div className="node-wrap" key={node}>
              <button className="system-node" aria-label={`Inspect ${node}`}>{node}</button>
              {index < nodes.length - 1 && <span className="connector" aria-hidden="true" />}
            </div>
          ))}
          <div className="gaia-branch">
            <span className="branch-line" />
            <button className="system-node gaia">GAIA / CASE 018</button>
          </div>
        </div>
      </div>
    </section>
  );
}
