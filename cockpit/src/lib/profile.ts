/**
 * profileId — Phase 6 foundation.
 *
 * A `profileId` is an **address-scoped, off-chain, non-authoritative** identity:
 * a wallet address whose profile is *assembled* from the existing read API
 * (recoverPaycards + paycard + history). No new id space, no contract changes.
 * The Vault remains the source of truth — per-stream authoritative state comes
 * from `/api/paycard/:id`; workflow grouping and the timeline are projections.
 */
import { useCallback, useEffect, useState } from "react";
import { getAddress, isAddress } from "viem";
import { api, type PaycardOnchain, type StreamEvent } from "./api";

export type ProfileId = string; // a checksummed wallet address
export type StreamRole = "payer" | "recipient" | "both";

export interface ProfileStream {
  state: PaycardOnchain;
  role: StreamRole;
  workflowId: string | null;
  events: StreamEvent[];
}

export interface WorkflowGroup {
  workflowId: string | null; // null = ungrouped
  streams: ProfileStream[];
}

export interface ProfileStats {
  escrowedBase: bigint; // as payer: Σ total allocation
  lockedBase: bigint; // as payer: Σ available on active streams
  earnedBase: bigint; // as recipient: Σ settled out (amountWithdrawn)
  recoveredBase: bigint; // residual swept to this address
  activeCount: number;
  terminatedCount: number;
  workflowCount: number;
  counterparties: number;
}

export interface Profile {
  id: ProfileId;
  streams: ProfileStream[];
  asPayer: ProfileStream[];
  asRecipient: ProfileStream[];
  workflows: WorkflowGroup[];
  timeline: StreamEvent[];
  stats: ProfileStats;
}

const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function buildStats(addr: string, streams: ProfileStream[]): ProfileStats {
  let escrowedBase = 0n;
  let lockedBase = 0n;
  let earnedBase = 0n;
  let recoveredBase = 0n;
  let activeCount = 0;
  let terminatedCount = 0;
  const workflows = new Set<string>();
  const counterparties = new Set<string>();

  for (const s of streams) {
    const st = s.state;
    if (st.operationalStatus === "Active") activeCount += 1;
    else terminatedCount += 1;
    if (s.workflowId) workflows.add(s.workflowId);

    if (eq(st.payer, addr)) {
      escrowedBase += BigInt(st.totalAllocationPool || "0");
      if (st.operationalStatus === "Active") lockedBase += BigInt(st.availableBalance || "0");
      counterparties.add(st.recipient.toLowerCase());
    }
    if (eq(st.recipient, addr)) counterparties.add(st.payer.toLowerCase());

    for (const ev of s.events) {
      if (ev.eventName === "SettlementFlushed" && eq(st.recipient, addr)) {
        earnedBase += BigInt((ev.args?.["amountWithdrawn"] as string) ?? "0");
      }
      if (ev.eventName === "ResidualDeltaReclaimed") {
        const to = (ev.args?.["recoveryVault"] as string) ?? st.residualDeltaRecipient;
        if (eq(to, addr)) recoveredBase += BigInt((ev.args?.["varianceSwept"] as string) ?? "0");
      }
    }
  }
  counterparties.delete(addr.toLowerCase());
  return {
    escrowedBase,
    lockedBase,
    earnedBase,
    recoveredBase,
    activeCount,
    terminatedCount,
    workflowCount: workflows.size,
    counterparties: counterparties.size,
  };
}

async function loadProfile(rawAddress: string, cap = 30): Promise<Profile> {
  const id = getAddress(rawAddress); // checksummed
  const addr = id.toLowerCase();

  // 1) Which paycards involve this address (both roles). Merge two sources:
  //    - the indexer projection (`/api/streams?payer|recipient`) — NOT block-bounded, so it
  //      surfaces old streams the bounded log-recovery window would miss;
  //    - onchain log recovery (`/api/paycards/recover`) — catches anything not yet indexed.
  const [payerRec, recipientRec, payerIdx, recipientIdx] = await Promise.all([
    api.recoverPaycards({ payer: id, limit: cap }).catch(() => ({ results: [] })),
    api.recoverPaycards({ recipient: id, limit: cap }).catch(() => ({ results: [] })),
    api.streams({ payer: id }).catch(() => ({ streams: [] })),
    api.streams({ recipient: id }).catch(() => ({ streams: [] })),
  ]);
  const ids: string[] = [];
  const seen = new Set<string>();
  const pushId = (pid: string) => {
    const key = pid.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ids.push(pid);
    }
  };
  for (const r of [...payerRec.results, ...recipientRec.results]) pushId(r.paycardId);
  for (const s of [...payerIdx.streams, ...recipientIdx.streams]) pushId(s.paycardId);

  // 2) Authoritative state + indexed history (workflowId + events) per stream.
  const loaded = await Promise.all(
    ids.slice(0, cap).map(async (pid) => {
      const [state, hist] = await Promise.all([
        api.paycard(pid).catch(() => null),
        api.history(pid).catch(() => ({ state: null, events: [] as StreamEvent[] })),
      ]);
      if (!state) return null;
      const role: StreamRole = eq(state.payer, addr) && eq(state.recipient, addr)
        ? "both"
        : eq(state.payer, addr)
        ? "payer"
        : "recipient";
      const ps: ProfileStream = {
        state,
        role,
        workflowId: hist.state?.workflowId ?? null,
        events: hist.events ?? [],
      };
      return ps;
    }),
  );
  const streams = loaded.filter((s): s is ProfileStream => s !== null);

  // Active first, then newest genesis.
  streams.sort((a, b) => {
    if (a.state.operationalStatus !== b.state.operationalStatus) {
      return a.state.operationalStatus === "Active" ? -1 : 1;
    }
    return b.state.genesisTimestamp - a.state.genesisTimestamp;
  });

  const asPayer = streams.filter((s) => s.role === "payer" || s.role === "both");
  const asRecipient = streams.filter((s) => s.role === "recipient" || s.role === "both");

  // Workflow groups (workflowId | null).
  const groupMap = new Map<string | null, ProfileStream[]>();
  for (const s of streams) {
    const key = s.workflowId ?? null;
    const arr = groupMap.get(key) ?? [];
    arr.push(s);
    groupMap.set(key, arr);
  }
  const workflows: WorkflowGroup[] = [...groupMap.entries()]
    .map(([workflowId, group]) => ({ workflowId, streams: group }))
    .sort((a, b) => (a.workflowId === null ? 1 : b.workflowId === null ? -1 : 0));

  // Merged receipt timeline (newest first).
  const timeline = streams
    .flatMap((s) => s.events)
    .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);

  return { id, streams, asPayer, asRecipient, workflows, timeline, stats: buildStats(addr, streams) };
}

export function isValidProfileId(s: string): boolean {
  return isAddress(s.trim());
}

export function useProfile(address: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!address || !isAddress(address)) {
      setProfile(null);
      setError(address ? "Not a valid wallet address" : null);
      return;
    }
    setLoading(true);
    setError(null);
    loadProfile(address)
      .then(setProfile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, error, refresh };
}
