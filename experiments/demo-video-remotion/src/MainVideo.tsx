import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide Transitions (each segment is 450 frames / 15 seconds)
  const opacitySlide1 = interpolate(frame, [0, 30, 420, 450], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacitySlide2 = interpolate(frame, [450, 480, 870, 900], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacitySlide3 = interpolate(frame, [900, 930, 1320, 1350], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacitySlide4 = interpolate(frame, [1350, 1380, 1770, 1800], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Telemetry drip counter calculations (ticks up from frame 900 to 1350)
  const currentDrip = interpolate(frame, [900, 1350], [0.0000, 0.0450], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill className="bg-gray-950 text-white font-sans overflow-hidden flex items-center justify-center">
      
      {/* 3D-Like Background Grid (Styled with Tailwind/CSS) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      
      {/* Slide 1: The Hook (0 - 15s) */}
      {frame >= 0 && frame < 450 && (
        <div style={{ opacity: opacitySlide1 }} className="flex flex-col items-center justify-center text-center p-8 max-w-4xl z-10">
          <div className="w-24 h-24 mb-8 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-4xl font-bold">OR</span>
          </div>
          <h1 className="text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Settle per-second.
          </h1>
          <p className="text-2xl text-cyan-400 font-mono mb-8">
            Recover what is unused.
          </p>
          <div className="p-6 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
            <p className="text-xl text-slate-300">
              OpenRails is intent-driven clearing and settlement infrastructure for streamed work.
            </p>
          </div>
        </div>
      )}

      {/* Slide 2: The Payer/Agent Side (15s - 30s) */}
      {frame >= 450 && frame < 900 && (
        <div style={{ opacity: opacitySlide2 }} className="flex flex-col items-center justify-center text-center p-8 max-w-4xl z-10">
          <span className="text-sm font-bold tracking-wider text-indigo-400 uppercase mb-2">Payer / Agent Security</span>
          <h2 className="text-5xl font-bold mb-6">Bounded Payment Budgets</h2>
          
          <div className="w-full bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-8 shadow-2xl text-left font-mono">
            <div className="flex items-center space-x-2 mb-4 border-b border-white/10 pb-4">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-slate-400 ml-2">Terminal - openrails-mcp</span>
            </div>
            <p className="text-green-400">$ openrails approve-cap --allowance 10.00 USDC</p>
            <p className="text-slate-300">✔ Wallet allowance approved to OpenRails Hub contract.</p>
            <p className="text-green-400 mt-2">$ openrails open-stream --recipient 0x7099... --velocity 0.001</p>
            <p className="text-yellow-400">✔ Signed EIP-712 Intent: e29ad10a... lane initialized.</p>
          </div>
        </div>
      )}

      {/* Slide 3: Telemetry Deck (30s - 45s) */}
      {frame >= 900 && frame < 1350 && (
        <div style={{ opacity: opacitySlide3 }} className="flex flex-col items-center justify-center text-center p-8 max-w-5xl z-10 w-full">
          <span className="text-sm font-bold tracking-wider text-cyan-400 uppercase mb-2">Continuous Telemetry</span>
          <h2 className="text-5xl font-bold mb-8">Real-Time Drip Accumulation</h2>
          
          <div className="grid grid-cols-3 gap-6 w-full">
            <div className="p-8 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
              <span className="text-xs text-slate-400 font-bold uppercase">Locked Escrow</span>
              <p className="text-4xl font-bold text-white mt-2">$10.00 USDC</p>
            </div>
            <div className="p-8 bg-cyan-950/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 shadow-2xl shadow-cyan-500/5">
              <span className="text-xs text-cyan-400 font-bold uppercase">Streaming Balance</span>
              <p className="text-4xl font-mono font-bold text-cyan-400 mt-2">
                ${currentDrip.toFixed(4)} USDC
              </p>
            </div>
            <div className="p-8 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
              <span className="text-xs text-slate-400 font-bold uppercase">Flow Velocity</span>
              <p className="text-4xl font-bold text-indigo-400 mt-2">0.0001/sec</p>
            </div>
          </div>
        </div>
      )}

      {/* Slide 4: Flush & Sweep (45s - 60s) */}
      {frame >= 1350 && frame < 1800 && (
        <div style={{ opacity: opacitySlide4 }} className="flex flex-col items-center justify-center text-center p-8 max-w-4xl z-10">
          <span className="text-sm font-bold tracking-wider text-green-400 uppercase mb-2">Capital Recovery</span>
          <h2 className="text-5xl font-bold mb-6">Flush & Return Sweep</h2>
          
          <div className="p-8 bg-green-950/20 backdrop-blur-md rounded-2xl border border-green-500/20 shadow-2xl shadow-green-500/5 max-w-2xl text-center">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl text-green-400">✔</span>
            </div>
            <h3 className="text-2xl font-bold mb-2">Stream Terminated Successfully</h3>
            <p className="text-slate-300 font-mono mb-4 text-sm">Tx: 0xb5f2cd38992a71cd9281577d4838f0...</p>
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 font-mono text-left">
              <div>
                <span className="text-xs text-slate-400">Settled to Payee:</span>
                <p className="text-xl font-bold text-white">$0.0450 USDC</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Swept to Wallet:</span>
                <p className="text-xl font-bold text-green-400">$9.9550 USDC</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
