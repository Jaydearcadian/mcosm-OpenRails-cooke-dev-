/**
 * Polls the indexer worker's /streams (all watched vaults) and exposes loading/error/empty
 * states plus derived aggregates. Shared by Deck, Streams, and Explorer's default state so they
 * all agree on one fetch rather than each polling independently.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { indexer, type IndexedStream, type IndexedVault } from "./indexer";

export type DataStatus = "loading" | "ready" | "error" | "empty";

export function useIndexerStreams(pollMs = 20000) {
  const [status, setStatus] = useState<DataStatus>("loading");
  const [streams, setStreams] = useState<IndexedStream[]>([]);
  const [vaults, setVaults] = useState<IndexedVault[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [fetchedAt, setFetchedAt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async (isRefresh?: boolean) => {
    setRefreshing(!!isRefresh);
    try {
      const [streamsRes, vaultsRes] = await Promise.all([indexer.streams(), indexer.vaults()]);
      if (!alive.current) return;
      setStreams(streamsRes.streams);
      setVaults(vaultsRes.vaults);
      setStatus(streamsRes.streams.length ? "ready" : "empty");
      setFetchedAt(Date.now());
    } catch (e) {
      if (!alive.current) return;
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    } finally {
      if (alive.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const id = setInterval(() => load(true), pollMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  const active = streams.filter((s) => s.status === "Active");
  const escrowBase = active.reduce((acc, s) => acc + BigInt(s.availableBalance || "0"), 0n);
  const velocityBase = active.reduce((acc, s) => acc + BigInt(s.velocity || "0"), 0n);
  const settledBase = streams.reduce((acc, s) => {
    const spent = BigInt(s.totalAllocation || "0") - BigInt(s.availableBalance || "0");
    return acc + (spent > 0n ? spent : 0n);
  }, 0n);

  return {
    status,
    streams,
    vaults,
    active,
    escrowBase,
    velocityBase,
    settledBase,
    errorMsg,
    fetchedAt,
    refreshing,
    refresh: () => load(true),
  };
}

export type IndexerStreamsData = ReturnType<typeof useIndexerStreams>;
