import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arcTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "OpenRails Cockpit",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "openrails-demo",
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
  },
  ssr: false,
});
