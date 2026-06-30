/**
 * OpenRails gateway client. Reads the live, non-authoritative indexer + config
 * endpoints. Base URL via VITE_OPENRAILS_API_BASE (default "" → same-origin,
 * which the Vite dev proxy forwards to the gateway). The Vault remains the
 * source of truth; everything here is a projection and is labeled as such.
 */
import { useEffect, useState } from "react";
import { chainReads } from "./chainReads";

const API_BASE = import.meta.env.VITE_OPENRAILS_API_BASE ?? "";

export interface GatewayConfig {
  networkMode: string;
  chainId: number;
  clearinghouseAddress: string;
  usdcAddress: string;
  explorerBaseUrl: string;
  relayerAddress?: string;
  relayerMode?: string;
}

export type PaycardStatus = "Active" | "PendingSettlement" | "Terminated";

export interface StreamState {
  paycardId: string;
  payer: string;
  recipient: string;
  metadataHash: string;
  totalAllocation: string; // base units (USDC 6dp)
  availableBalance: string;
  velocity: string; // base units / sec
  genesis: number;
  lifespan: number;
  lastCheckpoint: number;
  status: PaycardStatus;
  workflowId?: string;
}

export interface StreamEvent {
  paycardId: string;
  eventName: string; // PaycardProvisioned | SettlementFlushed | ResidualDeltaReclaimed
  workflowId?: string;
  metadataHash?: string;
  blockNumber: number;
  blockTimestamp?: number;
  transactionHash: string;
  logIndex: number;
  args: Record<string, unknown>;
  recordedAt: number;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface PaycardOnchain {
  paycardId: string;
  payer: string;
  recipient: string;
  metadataHash: string;
  totalAllocationPool: string;
  availableBalance: string;
  flowVelocityPerSecond: string;
  genesisTimestamp: number;
  lifespanSeconds: number;
  lastCheckpointEpoch: number;
  residualDeltaRecipient: string;
  operationalStatus: "Active" | "Terminated";
}

export interface RecoveredPaycard {
  paycardId: string;
  source?: string;
  registry?: { payer: string; recipient: string; metadataHash: string; operationalStatus: string };
  provisioned?: { payer: string; recipient: string; metadataHash: string; blockNumber: number; transactionHash: string };
}

export const api = {
  // Gateway-first, with a client-side chain-read fallback so the cockpit works standalone
  // (e.g. hosted on Cloudflare Pages with no backend). Indexer-only views degrade to empty.
  config: () => getJSON<GatewayConfig>("/api/config").catch(() => chainReads.config()),
  streams: (q: Record<string, string> = {}) => {
    const qs = new URLSearchParams(q).toString();
    return getJSON<{ count: number; streams: StreamState[]; authoritative: boolean }>(
      `/api/streams${qs ? `?${qs}` : ""}`,
    ).catch(() => ({ count: 0, streams: [] as StreamState[], authoritative: false }));
  },
  history: (paycardId: string) =>
    getJSON<{ paycardId: string; state: StreamState | null; events: StreamEvent[]; authoritative: boolean }>(
      `/api/streams/${paycardId}/history`,
    ).catch(() => ({ paycardId, state: null, events: [] as StreamEvent[], authoritative: false })),
  paycard: (id: string) => getJSON<PaycardOnchain>(`/api/paycard/${id}`).catch(() => chainReads.paycard(id)),
  balance: (address: string) => getJSON<{ balance: string }>(`/api/balance/${address}`).catch(() => chainReads.balance(address)),
  allowance: (owner: string) => getJSON<{ allowance: string }>(`/api/allowance/${owner}`).catch(() => chainReads.allowance(owner)),
  nonce: (payer: string, channel: number) =>
    getJSON<{ nonce: string }>(`/api/nonce/${payer}/${channel}`).catch(() => chainReads.nonce(payer, channel)),
  recoverPaycards: (params: { payer?: string; recipient?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.payer) q.set("payer", params.payer);
    if (params.recipient) q.set("recipient", params.recipient);
    if (params.limit) q.set("limit", String(params.limit));
    return getJSON<{ results: RecoveredPaycard[]; count: number }>(
      `/api/paycards/recover?${q.toString()}`,
    ).catch(() => chainReads.recoverPaycards(params));
  },
  x402Status: () =>
    fetch(`${API_BASE}/api/x402/openrails-artifact`, { redirect: "manual" }).then((r) => r),
  openPaycard: (body: {
    envelopeToken: string;
    mode: string;
    claimRecipient?: string;
    paycardId: string;
    metadataHash: string;
  }) =>
    fetch(`${API_BASE}/api/paycard/open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenRails-Paycard-Id": body.paycardId,
        "X-OpenRails-Metadata-Hash": body.metadataHash,
      },
      body: JSON.stringify({
        envelopeToken: body.envelopeToken,
        mode: body.mode,
        claimRecipient: body.claimRecipient,
      }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      return data as { txHash: string; blockNumber: number; paycardId: string; mode: string };
    }),
  dripSettle: (paycardId: string) =>
    fetch(`${API_BASE}/api/paycard/drip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paycardId }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      return data as { txHash: string; blockNumber: number; settledAmount: string };
    }),
};

// ---- formatting helpers ----
export const USDC_DP = 6;
export function toUsdc(baseUnits: string | bigint): number {
  const n = typeof baseUnits === "bigint" ? baseUnits : BigInt(baseUnits || "0");
  return Number(n) / 10 ** USDC_DP;
}
export function fmtUsd(n: number, dp = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
export function shortHex(s: string, lead = 6, tail = 4): string {
  if (!s || s.length < lead + tail + 2) return s;
  return `${s.slice(0, lead)}…${s.slice(-tail)}`;
}
export function sumBase(values: string[]): bigint {
  return values.reduce((acc, v) => acc + BigInt(v || "0"), 0n);
}

// ---- hooks ----
export interface ConnectionState {
  online: boolean;
  error?: string;
}

export function useConfig() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [conn, setConn] = useState<ConnectionState>({ online: false });
  useEffect(() => {
    let alive = true;
    api
      .config()
      .then((c) => alive && (setConfig(c), setConn({ online: true })))
      .catch((e) => alive && setConn({ online: false, error: String(e.message ?? e) }));
    return () => {
      alive = false;
    };
  }, []);
  return { config, conn };
}

/** Poll the stream list; returns active streams + derived totals. */
export function useStreams(pollMs = 8000) {
  const [streams, setStreams] = useState<StreamState[]>([]);
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      api
        .streams()
        .then((r) => alive && (setStreams(r.streams), setOnline(true)))
        .catch(() => alive && setOnline(false));
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);

  const active = streams.filter((s) => s.status === "Active");
  const escrowBase = sumBase(active.map((s) => s.availableBalance));
  const velocityBase = sumBase(active.map((s) => s.velocity));
  return { streams, active, escrowBase, velocityBase, online };
}

/** Poll a single connected wallet's USDC balance and Hub allowance. */
export function useWalletBalance(address: string | undefined, hubAddress: string | undefined, pollMs = 15000) {
  const [balance, setBalance] = useState<string>("0");
  const [allowance, setAllowance] = useState<string>("0");
  useEffect(() => {
    if (!address || !hubAddress) return;
    let alive = true;
    const tick = () =>
      Promise.all([api.balance(address), api.allowance(address)]).then(([b, a]) => {
        if (!alive) return;
        setBalance(b.balance);
        setAllowance(a.allowance);
      }).catch(() => {});
    tick();
    const id = setInterval(tick, pollMs);
    return () => { alive = false; clearInterval(id); };
  }, [address, hubAddress, pollMs]);
  return { balance, allowance };
}

/** Merge recent events across the listed streams into a ledger feed. */
export function useLedger(streams: StreamState[], limit = 12) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  useEffect(() => {
    let alive = true;
    if (streams.length === 0) {
      setEvents([]);
      return;
    }
    const ids = streams.slice(0, 8).map((s) => s.paycardId);
    Promise.all(ids.map((id) => api.history(id).then((h) => h.events).catch(() => [])))
      .then((lists) => {
        if (!alive) return;
        const merged = lists.flat().sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
        setEvents(merged.slice(0, limit));
      })
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [streams.map((s) => s.paycardId).join(","), limit]);
  return events;
}
