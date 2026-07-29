export type DocSection = {
  id: string;
  title: string;
  body?: string[];
  callout?: string;
  properties?: Array<[string, string]>;
  code?: string;
};

export type DocPage = {
  slug: string;
  category: string;
  index: string;
  title: string;
  summary: string;
  status?: 'FOUNDATION' | 'LIVE' | 'REFERENCE';
  sections: DocSection[];
};

export const docsPages: DocPage[] = [
  {
    slug: 'overview', category: 'INTRODUCTION', index: '01', title: 'Overview', status: 'FOUNDATION',
    summary: 'OpenRails is programmable settlement infrastructure for machine commerce, extended with explicit authority, agreement, evidence, and resolution.',
    sections: [
      { id: 'thesis', title: 'The thesis', body: ['Software now negotiates, purchases, performs work, and coordinates economic activity continuously. Ordinary transfers remain blunt events: they move value but preserve little context about the authority, limits, agreement, or evidence behind that movement.', 'OpenRails creates bounded programmable rails and places an accountable commercial lifecycle around them.'] },
      { id: 'lifecycle', title: 'The complete lifecycle', properties: [['Own', 'Workspace establishes economic ownership.'], ['Authorise', 'Path defines bounded authority.'], ['Commit', 'Pact freezes accepted commercial terms.'], ['Prove', 'Evidence advances settlement eligibility.'], ['Settle', 'RailsFlow and Paycard move value canonically.'], ['Resolve', 'Gaia handles bounded exceptions.']] },
      { id: 'boundaries', title: 'Execution boundaries', callout: 'The Runtime coordinates. The wallet authorises. The network finalises.', body: ['The OpenRails Runtime does not possess private keys. It evaluates, prepares, records, and verifies. Wallet signatures establish authority and approve financial actions. The deployed protocol and network receipts preserve canonical financial state.'] }
    ]
  },
  {
    slug: 'why-openrails', category: 'INTRODUCTION', index: '02', title: 'Why OpenRails', status: 'FOUNDATION',
    summary: 'Machine commerce needs something between no authority and unlimited wallet authority.',
    sections: [
      { id: 'ordinary-payments', title: 'The limitation of ordinary payments', body: ['A transaction proves that value moved. It rarely proves why it was permitted, what velocity applied, which agent acted, what commercial terms were accepted, or what evidence made settlement appropriate.'] },
      { id: 'bounded-rails', title: 'Bounded rails', properties: [['Allocation', 'The maximum value committed to a rail.'], ['Velocity', 'How quickly value can become earned or drawable.'], ['Expiry', 'When delegated payment authority ends.'], ['Nonce lane', 'An isolated execution sequence for the activity.'], ['Residual', 'Where unused value returns.']] },
      { id: 'accountability', title: 'Beyond settlement', body: ['Programmable movement is necessary but insufficient. OpenRails also records who owns the activity, who may act, what exact commitment formed, what evidence supports performance, and how bounded resolution should proceed.'] }
    ]
  },
  {
    slug: 'architecture', category: 'INTRODUCTION', index: '03', title: 'System architecture', status: 'REFERENCE',
    summary: 'The Protocol moves value. The Runtime controls and contextualises access to that movement. Clients expose the system.',
    sections: [
      { id: 'protocol', title: 'OpenRails Protocol', properties: [['RailsCard', 'Macro allocation and bounded payment authority.'], ['RailsFlow', 'Typed intent for programmable value movement.'], ['Paycard', 'Canonical per-payment financial object.'], ['Vault', 'Custody and accounting boundary.'], ['STN-Delta', 'Earned and residual routing.']] },
      { id: 'runtime', title: 'OpenRails Runtime', properties: [['Workspace', 'Economic ownership and membership.'], ['Path', 'Delegated authority boundary.'], ['Baphomet', 'Deterministic policy evaluation.'], ['Pact', 'Commercial commitment.'], ['Proof', 'Evidence and checkpoint state.'], ['Gaia', 'Bounded exception handling.']] },
      { id: 'clients', title: 'OpenRails Clients', body: ['The System Lab, future personal dashboard, Telegram sidecar, SDK, MCP, REST API, and application integrations are clients of the same underlying system. No single client is OpenRails itself.'] }
    ]
  },
  {
    slug: 'railsflow', category: 'SETTLEMENT PROTOCOL', index: '04', title: 'RailsFlow', status: 'LIVE',
    summary: 'A wallet-signed, bounded settlement intent that describes how value may move through an OpenRails rail.',
    sections: [
      { id: 'definition', title: 'What it is', body: ['RailsFlow is the micro-authorisation layer for an individual programmable payment. It binds the payer, recipient, Paycard identity, allocation, timing, nonce lane, and settlement metadata.'] },
      { id: 'fields', title: 'Core fields', code: `{
  payer,
  recipient,
  paycardId,
  allocation,
  startsAt,
  expiresAt,
  nonceLane,
  nonce,
  metadataHash
}` },
      { id: 'boundary', title: 'What it cannot do', callout: 'A prepared RailsFlow is not a transaction.', body: ['The Runtime may prepare typed data, but only the wallet can sign it and only the connected account can submit the corresponding transaction.'] }
    ]
  },
  {
    slug: 'paycard', category: 'SETTLEMENT PROTOCOL', index: '05', title: 'Paycard and Vault', status: 'LIVE',
    summary: 'The Paycard is the canonical financial object; the Vault is the custody and accounting boundary beneath it.',
    sections: [
      { id: 'states', title: 'Paycard lifecycle', properties: [['Prepared', 'Terms exist but no canonical financial object has opened.'], ['Active', 'Allocation has entered the deployed rail.'], ['Earning', 'Value becomes eligible according to the bound schedule and policy.'], ['Settled', 'Earned value has been routed.'], ['Terminated', 'Residual value has been handled and the rail is closed.']] },
      { id: 'receipt', title: 'Canonical evidence', body: ['OpenRails does not treat a browser state transition as settlement. The Runtime observes the exact contract, event, chain, transaction hash, and receipt status before advancing canonical financial state.'] }
    ]
  },
  {
    slug: 'workspace-path', category: 'CONTROL RUNTIME', index: '06', title: 'Workspace and Path', status: 'REFERENCE',
    summary: 'Workspace establishes ownership. Path defines what an actor or agent may prepare inside that ownership boundary.',
    sections: [
      { id: 'workspace', title: 'Workspace', body: ['A Workspace anchors the principal, members, applications, and agents. It is the root of economic ownership and administration for the activity represented inside OpenRails.'] },
      { id: 'path', title: 'Path', properties: [['Action', 'Which operation may be proposed.'], ['Asset', 'Which settlement asset is permitted.'], ['Counterparty', 'Which party or class of party is allowed.'], ['Exposure', 'Maximum value per Pact and in aggregate.'], ['Velocity', 'Maximum draw or earning rate.'], ['Duration', 'Maximum authority and commitment horizon.']] },
      { id: 'not-payment', title: 'Important distinction', callout: 'A Path does not move funds. It determines whether a proposal may proceed toward a Pact and wallet action.' }
    ]
  },
  {
    slug: 'baphomet', category: 'CONTROL RUNTIME', index: '07', title: 'Proposal and Baphomet', status: 'REFERENCE',
    summary: 'A proposal requests an action. Baphomet evaluates that exact request against assigned authority and current economic state.',
    sections: [
      { id: 'proposal', title: 'Proposal', code: `{
  workspaceId,
  agentId,
  pathId,
  action,
  asset,
  value,
  counterparty,
  duration
}` },
      { id: 'decision', title: 'Decision', properties: [['ALLOW', 'The proposal may proceed toward commitment.'], ['BLOCK', 'The proposal stops before Pact formation, wallet request, or value movement.']] },
      { id: 'binding', title: 'Deterministic binding', body: ['The decision binds to the Workspace, Path revision, proposal hash, reason codes, and economic state evaluated. ALLOW is not payment; it is permission to continue.'] }
    ]
  },
  {
    slug: 'pact', category: 'CONTROL RUNTIME', index: '08', title: 'Pact', status: 'REFERENCE',
    summary: 'A Pact freezes the exact commercial commitment accepted by the participating parties.',
    sections: [
      { id: 'contents', title: 'What a Pact contains', properties: [['Parties', 'The principals or authorised actors bound to the commitment.'], ['Terms', 'Value, duration, recipient, asset, and performance terms.'], ['Proof policy', 'The evidence and checkpoints required.'], ['Settlement policy', 'How eligible value may settle.'], ['Exception policy', 'How a bounded Gaia process may begin.']] },
      { id: 'binding-chain', title: 'Binding chain', code: `pathHash
  → proposalHash
  → decisionHash
  → pactTermsHash
  → party signatures` },
      { id: 'boundary', title: 'What a Pact is not', callout: 'A Pact is not itself custody and does not independently move value.' }
    ]
  },
  {
    slug: 'proof-gaia', category: 'CONTROL RUNTIME', index: '09', title: 'Proof and Gaia', status: 'REFERENCE',
    summary: 'Proof makes performance inspectable. Gaia preserves and resolves bounded exception paths.',
    sections: [
      { id: 'proof', title: 'Proof', body: ['Evidence is attached to Pact checkpoints and evaluated by the configured verifier. A verified checkpoint may advance settlement eligibility, but does not bypass wallet or contract boundaries.'] },
      { id: 'gaia', title: 'Gaia', body: ['Gaia is not an unrestricted autonomous judge. It operates inside the dispute, evidence, and rectification rules already bound to the Pact, while preserving the history that led to the exception.'] },
      { id: 'normal-exception', title: 'Normal and exception paths', properties: [['Normal', 'Pact → Proof → wallet confirmation → settlement receipt.'], ['Exception', 'Pact → evidence bundle → Gaia determination → bounded rectification obligation.']] }
    ]
  },
  {
    slug: 'agent-kernel', category: 'BUILD', index: '10', title: 'Agent Kernel', status: 'REFERENCE',
    summary: 'The backend coordination kernel for Workspace, agent, Path, proposal, Pact, Proof, plugin, and Gaia state.',
    sections: [
      { id: 'responsibilities', title: 'Responsibilities', body: ['The Agent Kernel prepares typed authority objects, evaluates proposals, persists commercial state, coordinates proof plugins, records canonical observations, and exposes bounded operator interfaces.'] },
      { id: 'security', title: 'Security posture', callout: 'No private keys. No autonomous signing. No hidden broadcast.', body: ['The public web gateway exposes a narrow same-origin subset of Kernel operations. Mutations require a wallet-authenticated session and exact signed payloads.'] },
      { id: 'clients', title: 'Client integrations', properties: [['Web', 'System Lab and future dashboard.'], ['Telegram', 'Conversational operations sidecar.'], ['MCP', 'Agent-readable state and action preparation.'], ['SDK', 'Typed application integration.'], ['REST', 'Bounded service integration.']] }
    ]
  },
  {
    slug: 'networks', category: 'NETWORK', index: '11', title: 'Networks and deployment', status: 'LIVE',
    summary: 'OpenRails is network-portable. The product language remains stable while deployment evidence comes from each configured network.',
    sections: [
      { id: 'portable-core', title: 'Portable core', body: ['Workspace, Path, proposal, Pact, Proof, RailsFlow, Paycard, settlement, and resolution are OpenRails concepts. They must not be renamed or visually redesigned for each chain.'] },
      { id: 'adapter', title: 'Network adapter', properties: [['Identity', 'Name, chain ID, and native gas symbol.'], ['Connectivity', 'RPC and explorer URLs.'], ['Assets', 'Settlement assets and decimals.'], ['Contracts', 'Factory, hub, vault, faucet, and related addresses.'], ['Evidence', 'Events, receipts, block status, and provenance links.']] },
      { id: 'current', title: 'Current demonstrator', callout: 'The current live System Lab is configured for GIWA Sepolia. Arc and later networks reuse the same product and design system through separate deployment adapters.' }
    ]
  },
  {
    slug: 'security', category: 'SECURITY', index: '12', title: 'Trust and wallet boundary', status: 'REFERENCE',
    summary: 'OpenRails coordinates commercial state without taking custody of user keys or treating offchain state as canonical settlement.',
    sections: [
      { id: 'wallet', title: 'Wallet boundary', body: ['Authority signatures, Pact signatures, token approvals, RailsFlow signatures, Paycard opening, and settlement transactions remain visible wallet actions.'] },
      { id: 'runtime', title: 'Runtime boundary', body: ['The Runtime may prepare, validate, persist, and observe. It must refuse raw private keys and must not silently sign or broadcast.'] },
      { id: 'network', title: 'Canonical boundary', body: ['Financial state advances only after exact network and contract verification. Recorded or demonstration states must be visibly distinguished from live receipts.'] },
      { id: 'provenance', title: 'Provenance labels', properties: [['DEMONSTRATION', 'Curated explanatory state; no claim of a live transaction.'], ['RECORDED', 'Replay backed by previously captured real evidence.'], ['LIVE', 'Current network read, wallet action, or confirmed receipt.']] }
    ]
  }
];

export const docCategories = Array.from(new Set(docsPages.map((page) => page.category)));
export const defaultDoc = docsPages[0];
