/**
 * Demo-only data for telemetry the gateway does not yet expose (wallet float,
 * client daemons, velocity sparkline, nonce-lane breakdown fallback). Every
 * consumer renders a visible "demo data" tag — these are never presented as
 * on-chain truth. Each item names the endpoint that would replace it.
 */

// Seam: would derive from the connected wallet's USDC balance (ethers / a
// balance endpoint). Demo float for the Master Allocation Pool.
export const MOCK_ALLOCATION_FLOAT_USD = 78989.09;
export const MOCK_DERIVATION_PATH = "m/44'/60'/0'/0/0";

// Seam: would be background x402 header-verification workers (no endpoint yet).
export interface Daemon {
  tag: string;
  label: string;
  ok: boolean;
}
export const MOCK_DAEMONS: Daemon[] = [
  { tag: "DG-01", label: "x402 header verify", ok: true },
  { tag: "DG-02", label: "facilitator poll", ok: true },
  { tag: "DG-03", label: "reconcile cron", ok: true },
];
export const MOCK_DAEMON_OVERFLOW = 2;

// Seam: short rolling history for the velocity trend chip sparkline.
export function mockSparkline(seed = 12): number[] {
  const out: number[] = [];
  let v = 40;
  for (let i = 0; i < seed; i++) {
    v += (Math.sin(i * 0.9) + Math.random() * 0.6) * 6;
    out.push(Math.max(8, v));
  }
  return out;
}

// Seam: STN/LTN delta realization fallback when the indexer has too few
// ResidualDeltaReclaimed events to draw a curve.
export function mockDeltaSeries(points = 24): { t: number; stn: number; ltn: number }[] {
  const out = [];
  let stn = 12000;
  let ltn = 8000;
  for (let i = 0; i < points; i++) {
    stn += Math.sin(i * 0.5) * 1400 + 600;
    ltn += Math.cos(i * 0.35) * 800 + 420;
    out.push({ t: i, stn: Math.max(0, stn), ltn: Math.max(0, ltn) });
  }
  return out;
}
