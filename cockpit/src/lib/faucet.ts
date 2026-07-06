/**
 * Client for the faucet Worker — capped, self-serve testnet USDC drip (also covers gas,
 * since USDC is Arc's native gas token). Public, CORS-enabled. Base URL via
 * VITE_OPENRAILS_FAUCET_BASE, default the deployed worker.
 */
const FAUCET_BASE =
  (import.meta.env.VITE_OPENRAILS_FAUCET_BASE as string | undefined) ??
  "https://openrails-faucet-worker.microcosm.workers.dev";

export type FaucetFundResult =
  | { ok: true; skipped: false; txHash: string; amount: string }
  | { ok: true; skipped: true; reason: string; balance: string }
  | { ok: false; error: string; retryAfterSeconds?: number; faucetAddress?: string; balance?: string };

export async function requestFaucetFund(address: string): Promise<FaucetFundResult> {
  try {
    const res = await fetch(`${FAUCET_BASE}/fund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `HTTP ${res.status}`,
        retryAfterSeconds: data.retryAfterSeconds,
        faucetAddress: data.faucetAddress,
        balance: data.balance,
      };
    }
    if (data.skipped) {
      return { ok: true, skipped: true, reason: data.reason ?? "already funded", balance: data.balance };
    }
    return { ok: true, skipped: false, txHash: data.txHash, amount: data.amount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
