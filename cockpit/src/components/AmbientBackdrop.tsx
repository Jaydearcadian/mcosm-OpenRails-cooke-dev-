/**
 * Deep, multi-layered "liquid glass" environment — volumetric light
 * refractions and organic chrome shapes rendered with CSS gradients + blurred
 * blobs (no external image dependency). Sits behind all content.
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden bg-base-900">
      {/* base vertical wash */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#0b1726_0%,#04070d_60%)]" />
      {/* emerald volumetric light, top-left */}
      <div className="absolute -left-40 -top-32 h-[42rem] w-[42rem] rounded-full bg-emerald-core/20 blur-[120px] animate-drift" />
      {/* cool chrome refraction, bottom-right */}
      <div className="absolute -bottom-48 -right-32 h-[40rem] w-[40rem] rounded-full bg-[#1f3b66]/30 blur-[130px] animate-drift [animation-delay:-6s]" />
      {/* faint warm specular, center */}
      <div className="absolute left-1/2 top-1/3 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[90px]" />
      {/* fine grid lattice for depth */}
      <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] bg-[size:64px_64px]" />
      {/* top vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(140%_100%_at_50%_0%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
