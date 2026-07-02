/**
 * @module relay
 * @description Client for the OpenRails sponsor relay, plus the high-level gasless flows.
 *
 * The Hub authenticates the signature, not the sender, so a funded relayer can submit
 * a signed intent on the user's behalf. This wraps the relay's HTTP surface:
 *
 * - `POST /relay-claim` — sponsor a RailsCard claim (live today).
 * - `POST /relay-open`  — sponsor a RailsFlow/stream open, optionally preceded by an
 *   EIP-2612 `permit` so the payer never sends an approval tx. (Endpoint built in the
 *   API chunk; the request/response contract is fixed here.)
 *
 * Non-custodial throughout: escrow is pulled from the recovered payer per their signed
 * intent; the relayer only pays gas.
 */
import type { LeptonOpenRailsClient, OpenRailsIntentV1, SignPermissionEnvelopeOptions } from './client';
import type { UsdcPermit } from './permit';

export interface RelayResult {
  txHash: string;
  paycardId: string;
  [key: string]: unknown;
}

type FetchLike = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export interface RelayClientOptions {
  /** Base URL of the relay (the keeper worker), e.g. https://…workers.dev */
  baseUrl: string;
  /** Injectable fetch (defaults to global fetch); handy for tests. */
  fetchImpl?: FetchLike;
}

export interface RelayClaimBody {
  envelopeToken: string;
  claimRecipient?: string;
}

export interface RelayOpenBody {
  envelopeToken: string;
  permit?: UsdcPermit;
}

/** Thin POST wrapper over the sponsor relay. Holds no keys and custodies nothing. */
export class RelayClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: RelayClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    const f = options.fetchImpl ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (!f) throw new Error('No fetch implementation available; pass fetchImpl');
    this.fetchImpl = f;
  }

  private async post(path: string, body: unknown): Promise<RelayResult> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? `relay ${path} → HTTP ${res.status}`);
    return data as RelayResult;
  }

  /** Sponsor a RailsCard claim (`/relay-claim`). */
  relayClaim(body: RelayClaimBody): Promise<RelayResult> {
    return this.post('/relay-claim', body);
  }

  /** Sponsor a RailsFlow/stream open (`/relay-open`), optionally with a permit. */
  relayOpen(body: RelayOpenBody): Promise<RelayResult> {
    return this.post('/relay-open', body);
  }
}

/**
 * Pay a RailsFlow / open a stream gaslessly: sign the intent (and, if provided, ship a
 * pre-signed permit) and hand it to the relay. The payer holds no gas and sends no
 * approval tx.
 */
export async function payGasless(params: {
  client: LeptonOpenRailsClient;
  relay: RelayClient;
  intent: OpenRailsIntentV1;
  options?: SignPermissionEnvelopeOptions;
  permit?: UsdcPermit;
}): Promise<RelayResult> {
  const envelopeToken = await params.client.signPermissionEnvelope(params.intent, params.options ?? {});
  return params.relay.relayOpen({ envelopeToken, permit: params.permit });
}

/**
 * Claim a RailsCard gaslessly. The card is already signed by the payer, so this only
 * forwards the envelope + the destination to the relay (which pays gas).
 */
export async function claimGasless(params: {
  relay: RelayClient;
  envelopeToken: string;
  claimRecipient?: string;
}): Promise<RelayResult> {
  return params.relay.relayClaim({
    envelopeToken: params.envelopeToken,
    claimRecipient: params.claimRecipient,
  });
}
