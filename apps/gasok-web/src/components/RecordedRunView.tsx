import recordedRun from '../data/recorded-runs/canonical-giwa-paycard-v1.json';
import {
  PaycardInstrument,
  type PaycardPact,
  type PaycardVerificationDecision,
} from './paycard/PaycardInstrument';
import './recorded-run.css';

type RecordedRunFixture = {
  fixtureId: string;
  title: string;
  description: string;
  lifecycle: {
    status: string;
    createdAt: string;
    settledAt: string;
  };
  network: {
    name: string;
    chainId: number;
    explorerBaseUrl: string;
    vault: string;
    token: string;
  };
  authority: {
    workspaceId: string;
    agentId: string;
    outcome: string;
    decision: {
      result: string;
      decisionHash?: string;
      summary?: string;
      evaluatedAt?: string;
    };
  };
  agreement: {
    pactId: string;
    pathId: string;
    pathRevision: number;
    proposalId: string;
    decisionId: string;
    decisionHash: string;
    termsHash: string;
    paymentTerms: {
      chainId: number;
      vault: string;
      token: string;
      payer: string;
      recipient: string;
      residualRecipient: string;
      maximumAllocationBaseUnits: string;
      velocityBaseUnitsPerSecond: string;
      lifespanSeconds: number;
    };
    commercialTerms: {
      title: string;
      amount: string;
      durationSeconds: number;
      recipientMode: string;
      proofRule: string;
    };
  };
  paycard: {
    paycardId: string;
    metadataHash: string;
    genesisTimestamp: number;
    nonceChannel: number;
    nonceValue: number;
    preparedAt: string;
    opening: {
      transactionHash: string;
      blockNumber: number;
      observedAt?: string;
      payer?: string;
      recipient?: string;
      availableBalanceBaseUnits?: string;
      operationalStatus?: number;
    };
    settlement: {
      transactionHash: string;
      blockNumber: number;
      settledAmountBaseUnits: string;
      final: boolean;
      observedAt?: string;
    };
  };
  proof: {
    verification: {
      decision: string;
      decisionHash?: string;
      reasonCodes?: string[];
      evaluatedAt?: string;
    };
  };
  timeline: Array<{
    sequence: number;
    type: string;
    actor: string;
    at: string;
  }>;
};

const fixture = recordedRun as unknown as RecordedRunFixture;

const pact = {
  pactId: fixture.agreement.pactId,
  proposalId: fixture.agreement.proposalId,
  decisionId: fixture.agreement.decisionId,
  decisionHash: fixture.agreement.decisionHash,
  workspaceId: fixture.authority.workspaceId,
  pathId: fixture.agreement.pathId,
  pathRevision: fixture.agreement.pathRevision,
  termsHash: fixture.agreement.termsHash,
  counterparty: fixture.agreement.paymentTerms.recipient,
  status: fixture.lifecycle.status,
  createdAt: fixture.lifecycle.createdAt,
  updatedAt: fixture.lifecycle.settledAt,
  paymentTerms: fixture.agreement.paymentTerms,
  openRails: {
    metadataHash: fixture.paycard.metadataHash,
    paycardId: fixture.paycard.paycardId,
    genesisTimestamp: fixture.paycard.genesisTimestamp,
    nonceChannel: fixture.paycard.nonceChannel,
    nonceValue: fixture.paycard.nonceValue,
    preparedAt: fixture.paycard.preparedAt,
    openingTxHash: fixture.paycard.opening.transactionHash,
    openingObservation: fixture.paycard.opening,
    settlements: [fixture.paycard.settlement],
  },
} as unknown as PaycardPact;

const verificationDecision = {
  pactId: fixture.agreement.pactId,
  ...fixture.proof.verification,
} as unknown as PaycardVerificationDecision;

function short(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

export function RecordedRunView() {
  const openingUrl =
    `${fixture.network.explorerBaseUrl}/tx/` +
    fixture.paycard.opening.transactionHash;

  const settlementUrl =
    `${fixture.network.explorerBaseUrl}/tx/` +
    fixture.paycard.settlement.transactionHash;

  return (
    <section
      className="recorded-run"
      aria-labelledby="recorded-run-title"
    >
      <header className="recorded-run-header">
        <div>
          <span>RECORDED CANONICAL RUN / {fixture.network.name}</span>
          <h3 id="recorded-run-title">{fixture.title}</h3>
          <p>{fixture.description}</p>
        </div>

        <div className="recorded-run-state">
          <span>FINAL STATE</span>
          <strong>{fixture.lifecycle.status.toUpperCase()}</strong>
          <small>READ-ONLY CANONICAL EVIDENCE</small>
        </div>
      </header>

      <div className="recorded-run-notice">
        <strong>No wallet action is triggered in this mode.</strong>
        <span>
          This surface replays evidence from a previously completed,
          wallet-confirmed GIWA lifecycle.
        </span>
      </div>

      <PaycardInstrument
        pact={pact}
        remaining={0}
        verificationDecision={verificationDecision}
        explorerUrl={fixture.network.explorerBaseUrl}
      />

      <div className="recorded-run-evidence">
        <article>
          <span>BAPHOMET</span>
          <strong>{fixture.authority.outcome}</strong>
          <code>
            {short(fixture.authority.decision.decisionHash ?? '')}
          </code>
        </article>

        <article>
          <span>PACT</span>
          <strong>SETTLED</strong>
          <code>{short(fixture.agreement.termsHash)}</code>
        </article>

        <article>
          <span>PROOF</span>
          <strong>
            {fixture.proof.verification.decision.toUpperCase()}
          </strong>
          <code>
            {short(fixture.proof.verification.decisionHash ?? '')}
          </code>
        </article>

        <article>
          <span>OPENING RECEIPT</span>
          <strong>BLOCK {fixture.paycard.opening.blockNumber}</strong>
          <a href={openingUrl} target="_blank" rel="noreferrer">
            {short(fixture.paycard.opening.transactionHash)} ↗
          </a>
        </article>

        <article>
          <span>SETTLEMENT RECEIPT</span>
          <strong>
            BLOCK {fixture.paycard.settlement.blockNumber}
          </strong>
          <a href={settlementUrl} target="_blank" rel="noreferrer">
            {short(fixture.paycard.settlement.transactionHash)} ↗
          </a>
        </article>

        <article>
          <span>FINALITY</span>
          <strong>
            {fixture.paycard.settlement.final ? 'FINAL' : 'PARTIAL'}
          </strong>
          <code>{fixture.agreement.commercialTerms.amount}</code>
        </article>
      </div>

      <div className="recorded-run-timeline">
        <div className="recorded-run-timeline-heading">
          <span>CANONICAL EVENT SEQUENCE</span>
          <strong>{fixture.timeline.length} EVENTS</strong>
        </div>

        <ol>
          {fixture.timeline.map((event) => (
            <li key={`${event.sequence}-${event.type}`}>
              <span>
                {String(event.sequence + 1).padStart(2, '0')}
              </span>
              <div>
                <strong>{event.type.replaceAll('_', ' ')}</strong>
                <small>{dateLabel(event.at)}</small>
              </div>
              <code>{short(event.actor)}</code>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
