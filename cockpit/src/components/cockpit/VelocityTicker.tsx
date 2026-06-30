import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Glass, Eyebrow, DemoTag } from "../Glass";
import { toUsdc } from "../../lib/api";

/**
 * Signature telemetry: a continuous sub-second rolling counter simulating the
 * lazy-evaluation drip output (ΔT × R). The RATE is live-derived (Σ velocity
 * over active streams). When no stream is active, falls back to a clearly
 * tagged demo rate so the hero stays alive. Pauses under prefers-reduced-motion.
 */
const DEMO_RATE = 3945.120834; // USDC/sec — flashy, demo-tagged

export function VelocityTicker({ velocityBase }: { velocityBase: bigint }) {
  const liveRate = toUsdc(velocityBase); // USDC / sec
  const isLive = liveRate > 0;
  const rate = isLive ? liveRate : DEMO_RATE;

  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(rate);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(rate);
      return;
    }
    start.current = null;
    let raf = 0;
    const loop = (t: number) => {
      if (start.current === null) start.current = t;
      const elapsed = (t - start.current) / 1000;
      // Stable integer part; the lower decimals roll to feel live.
      const roll = (Math.sin(elapsed * 5.1) * 0.5 + 0.5) * 0.4837 + (elapsed % 1) * 0.0003;
      setDisplay(rate + roll);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rate, reduce]);

  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>Real-time streaming velocity</Eyebrow>
        {isLive ? (
          <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-emerald-core">
            <span className="h-1.5 w-1.5 animate-pulse-orb rounded-full bg-emerald-core" />
            ΔT × R · live
          </span>
        ) : (
          <DemoTag />
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="telemetry text-3xl font-semibold text-ink-primary">
          +{display.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
        </span>
        <span className="font-mono text-xs tracking-wider text-ink-secondary">USDC / SEC</span>
      </div>
      <p className="mt-2 font-mono text-[11px] text-ink-faint">
        {isLive
          ? "Σ velocity over active Paycard Streams (non-authoritative)"
          : "no active streams — demo rate; opens live when a stream is provisioned"}
      </p>
    </Glass>
  );
}
