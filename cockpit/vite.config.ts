import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// OpenRails Cockpit dev server. Proxies /api to the OpenRails gateway so the
// cockpit can call live endpoints without CORS friction in dev. Override the
// target with OPENRAILS_API_TARGET (default http://localhost:3001).
const API_TARGET = process.env.OPENRAILS_API_TARGET || "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
});
