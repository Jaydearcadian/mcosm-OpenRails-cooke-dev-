import { Link } from 'react-router-dom';

import { RuntimeArchitecture } from '../components/RuntimeArchitecture';

export default function BuildRoute() {
  return (
    <main className="editorial-page build-page">
      <section className="page-hero">
        <span className="tech-label">BUILD / OPENRAILS RUNTIME</span>
        <h1>
          Infrastructure for accountable
          <br />
          <span>programmable commerce.</span>
        </h1>
        <p>
          The BNH Runtime coordinates policy evaluation, action state,
          verification, GIWA observation, and bounded rectification
          without owning a signing key.
        </p>
      </section>

      <RuntimeArchitecture />

      <section className="build-evidence">
        <div>
          <span>SDK</span>
          <strong>Prepare bounded RailsFlow drafts</strong>
          <small>
            Typed inputs, projected economics, metadata binding, and
            wallet-ready output.
          </small>
        </div>

        <div>
          <span>MCP</span>
          <strong>Read and prepare without signing</strong>
          <small>
            Safe agent tools that expose state and build actions while
            keeping keys outside the runtime.
          </small>
        </div>

        <div>
          <span>TELEGRAM</span>
          <strong>Conversational operational sidecar</strong>
          <small>
            Requests and status in chat; authority, evidence, and
            canonical state remain in OpenRails.
          </small>
        </div>
      </section>

      <section className="interface-ledger">
        <div className="section-index">
          <span>02</span>
          <strong>INTERFACE CONTRACTS</strong>
        </div>

        <div className="interface-grid">
          <article>
            <span>PROPOSAL</span>
            <code>
              {'{ workspaceId, pathId, action, value, counterparty }'}
            </code>
            <p>
              A requested commercial action. It is not authority and it
              is not a transaction.
            </p>
          </article>

          <article>
            <span>DECISION</span>
            <code>
              {'{ result: "ALLOW", pathHash, proposalHash, reasonCodes }'}
            </code>
            <p>
              Baphomet binds an outcome to the exact policy and economic
              state evaluated.
            </p>
          </article>

          <article>
            <span>OBSERVATION</span>
            <code>
              {'{ chainId: 91342, txHash, blockNumber, status }'}
            </code>
            <p>
              GIWA observation advances canonical financial state only
              after receipt verification.
            </p>
          </article>
        </div>
      </section>

      <section className="build-closing">
        <span>03 / AUTHORIZATION BOUNDARY</span>
        <h2>
          The Runtime coordinates.
          <br />
          The wallet authorises.
          <br />
          GIWA finalises.
        </h2>

        <Link to="/network">Inspect live deployment →</Link>
      </section>
    </main>
  );
}
