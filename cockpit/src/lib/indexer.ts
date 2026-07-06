/**
 * Client for the durable indexer Worker (factory-aware, D1-backed). Every response is
 * `authoritative: false` — the onchain Vault is always the source of truth; this is a
 * projection. Base URL via VITE_OPENRAILS_INDEXER_BASE, default the deployed worker.
 */
const INDEXER_BASE =
  (import.meta.env.VITE_OPENRAILS_INDEXER_BASE as string | undefined) ??
  "https://openrails-indexer-worker.microcosm.workers.dev";

export interface IndexedVault {
  vaultAddress: string;
  discoverySource: "canonical" | "factory";
  ownerAddress: string | null;
  tokenAddress: string | null;
  discoveredAtBlock: number;
}

export type IndexedStreamStatus = "Active" | "Terminated";

export interface IndexedStream {
  vaultAddress: string;
  paycardId: string;
  payer: string;
  recipient: string;
  metadataHash: string;
  totalAllocation: string; // wei string
  availableBalance: string; // wei string
  velocity: string; // wei/sec string
  genesis: number;
  lifespan: number;
  lastCheckpoint: number;
  status: IndexedStreamStatus;
  updatedAt: number;
}

export interface IndexedEvent {
  eventName: "PaycardProvisioned" | "SettlementFlushed" | "ResidualDeltaReclaimed";
  blockNumber: number;
  blockTimestamp: number | null;
  transactionHash: string;
  logIndex: number;
  args: Record<string, string>;
}

export interface StreamHistoryResponse {
  authoritative: false;
  disclaimer: string;
  vaultAddress: string;
  paycardId: string;
  state: IndexedStream | null;
  events: IndexedEvent[];
}

export interface StreamsQuery {
  vaultAddress?: string;
  paycardId?: string;
  payer?: string;
  recipient?: string;
  metadataHash?: string;
  status?: IndexedStreamStatus;
}

async function getJSON<T>(path: string): Promise<T> {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(`${INDEXER_BASE}${path}`, {
      headers: { accept: "application/json" },
      signal: ctl.signal,
    });
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok && res.status !== 404 && res.status !== 501) {
      throw new Error((data as { error?: string }).error ?? `${path} → HTTP ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const indexer = {
  vaults: () => getJSON<{ authoritative: false; count: number; vaults: IndexedVault[] }>("/vaults"),

  streams: (q: StreamsQuery = {}) => {
    const qs = new URLSearchParams(q as Record<string, string>).toString();
    return getJSON<{ authoritative: false; count: number; streams: IndexedStream[] }>(
      `/streams${qs ? `?${qs}` : ""}`,
    );
  },

  history: (vaultAddress: string, paycardId: string) =>
    getJSON<StreamHistoryResponse>(`/streams/${vaultAddress}/${paycardId}/history`),

  transactions: (hash: string) =>
    getJSON<{
      authoritative: false;
      transactionHash: string;
      events: IndexedEvent[];
      streams: IndexedStream[];
    }>(`/transactions/${hash}`),

  /** Always returns a 501-shaped "not supported yet" response today — surface it honestly. */
  workflow: (id: string) =>
    getJSON<{
      authoritative: false;
      workflowId: string;
      streams: IndexedStream[];
      events: IndexedEvent[];
      note: string;
    }>(`/workflows/${encodeURIComponent(id)}`),
};

export function isEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export function isBytes32Hex(v: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(v);
}
