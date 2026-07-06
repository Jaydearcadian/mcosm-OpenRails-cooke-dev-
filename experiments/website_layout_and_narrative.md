# OpenRails Landing Page Design, Narrative & Motion Specification

This document defines the layout sections, copy narrative, multi-page structure, and animation system for the OpenRails web application.

---

## 1. Landing Page Composition & Narrative Flow

The landing page follows a narrative that introduces the problem of static billing and presents OpenRails as the ultimate continuous utility rail.

### Section 1: The Hero Block (The Paradigm Shift)
* **Visual**: A dark slate canvas (`#030712`) overlayed with a 3D indigo/cyan flowing particle stream (Three.js). A central frosted glass panel containing the headline.
* **Copy**:
  * **Headline**: "Payments shouldn't stop. Settle per-second."
  * **Subheadline**: "Intent-driven clearing and settlement infrastructure for streamed work. Secure, bounded USDC escrows for AI agents, creators, and developers."
  * **CTAs**: `[Launch Cockpit]` (cyan solid button) and `[View SDK]` (glass transparent button).

### Section 2: The Friction (The Problem We Solve)
* **Concept**: Contrast the old legacy payments model with the continuous model.
* **Copy**:
  * *"Why are you paying for a full month's subscription when your agent only ran for 45 seconds? Web2 billing is rigid and high-fee. OpenRails settles value incrementally as services are consumed, and automatically sweeps the remaining safety buffer back to your wallet the moment work stops."*

### Section 3: The Three Pillars (Who It Is For)
A 3-column glassmorphic grid showcasing the flagship use cases:
1. **Agentic Wallets (AI)**: *"Delegate budgets, not keys. Set time-bounded escrows for LLMs with strict daily velocity limits to prevent runaway spending loops."*
2. **Sovereign Patronage (Creators)**: *"Stream micro-royalties directly to artists' wallets per second of media play (e.g. Navidrome integration), bypassing distributor cuts."*
3. **Citation Tolls (Merchants)**: *"Charge crawler bots per citation or API request gaslessly, matching Web2 API latency with Web3 on-chain finality."*

### Section 4: Live Telemetry Preview
* **Visual**: Embeds the [dashboard_mockup_1783150476398.jpg](file:///home/jay/codex/lepton/assets/dashboard_mockup_1783150476398.jpg) image inside a glowing, border-lit glass panel, demonstrating active streams, velocity tickers, and claimable card states.

---

## 2. Multi-Page Structure (The 4 Linked Pages)

We split the application into four distinct pages:

```
                  ┌───────────────────────────────┐
                  │      1. LANDING (/)           │
                  │  - Narrative, Hero, & Pitch   │
                  └──────────────┬────────────────┘
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│ 2. COCKPIT (/app) │  │ 3. REGISTRY (/reg)│  │  4. DOCS (/docs)  │
│ - Wallet Open     │  │ - MBID -> Wallet  │  │ - SDK Guides      │
│ - Stream Tracker  │  │ - Artist Claims   │  │ - API References  │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

1. **`/` (Landing Page)**: SEO-optimized, static-rendered page built for conversion.
2. **`/app` (The Cockpit WebApp)**: The interactive Web3 app. Connects the user's wallet (via RainbowKit) to manage active streams, allocations, and flushes.
3. **`/registry` (MusicBrainz Directory)**: A public lookup tool. Artists connect their wallets to claim their MusicBrainz IDs (MBIDs), and listeners verify artist payment mappings.
4. **`/docs` (Developer Portal)**: Developer guides for integrating the TypeScript SDK and running the ListenBrainz/Subsonic webhook sidecars.

---

## 3. The Animation Specification (Expressing Motion)

To make the interface feel alive, we combine React Three Fiber (R3F) for 3D depth and Framer Motion for UI component transitions.

### A. 3D Particle Flow (Three.js / Canvas)
* **The Motion**: Particles flow smoothly down the Y-axis inside an invisible cylinder. 
* **Interactive Parallax**: The rotation of the particle system tilts slightly based on the user's cursor coordinates:
  ```typescript
  useFrame((state) => {
    const { x, y } = state.pointer;
    ref.current.rotation.x = (y * Math.PI) / 10;
    ref.current.rotation.y = (x * Math.PI) / 10;
  });
  ```

### B. Glass-Blur Entrance Transitions (Framer Motion)
When a page loads, elements should not just pop in. They should emerge out of the glass blur:
* **The Effect**: The card fades in from `opacity: 0` while the `backdrop-filter: blur(0px)` animates to `blur(12px)`.
* **Code Example**:
  ```typescript
  const glassEntrance = {
    hidden: { opacity: 0, backdropFilter: "blur(0px)" },
    visible: { 
      opacity: 1, 
      backdropFilter: "blur(12px)",
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };
  ```

### C. Hover Glow States
Buttons and panels should glow dynamically when hovered:
* **The Effect**: On hover, scale the element slightly (`scale: 1.02`) and transition the border color from `border-white/10` to `border-cyan-500/40`, accompanied by a subtle drop shadow glow.
* **CSS Class**: `hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300`
