import type { Config } from "tailwindcss";

// OpenRails Cockpit design tokens — emerald "Liquid Glass" system (per the
// Core Telemetry Cockpit spec). Swiss/International typography: JetBrains Mono
// for telemetry/data, Inter for interface text.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        glass: {
          bg: "rgba(255,255,255,0.05)",
          border: "rgba(255,255,255,0.12)",
        },
        ink: {
          primary: "#FFFFFF",
          secondary: "rgba(255,255,255,0.60)",
          faint: "rgba(255,255,255,0.38)",
        },
        emerald: {
          core: "#009E60",
          glow: "rgba(0,158,96,0.25)",
        },
        base: {
          900: "#04070D",
          800: "#070B14",
          700: "#0B1120",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        widest2: "0.18em",
      },
      backdropBlur: {
        glass: "24px",
      },
      boxShadow: {
        glass:
          "inset 1px 1px 0px rgba(255,255,255,0.15), 0 8px 32px 0 rgba(0,0,0,0.37)",
        "emerald-glow": "0 0 24px 0 rgba(0,158,96,0.35)",
      },
      keyframes: {
        "pulse-orb": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(1.18)" },
        },
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%,-3%,0) scale(1.06)" },
        },
      },
      animation: {
        "pulse-orb": "pulse-orb 2.4s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
