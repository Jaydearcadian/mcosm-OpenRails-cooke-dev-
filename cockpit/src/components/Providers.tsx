import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { PrivyProvider } from "@privy-io/react-auth";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "../lib/wagmi-config";

const queryClient = new QueryClient();

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

const rkTheme = darkTheme({
  accentColor: "#009E60",
  accentColorForeground: "#04070D",
  borderRadius: "large",
  overlayBlur: "small",
});

function WagmiTree({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <WagmiTree>{children}</WagmiTree>;
  }
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#009E60",
          logo: "",
        },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <WagmiTree>{children}</WagmiTree>
    </PrivyProvider>
  );
}
