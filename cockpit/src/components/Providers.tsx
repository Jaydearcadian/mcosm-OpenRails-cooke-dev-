import type { ReactNode } from "react";
import { WagmiProvider as BareWagmiProvider } from "wagmi";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { wagmiConfig } from "../lib/wagmi-config";

const queryClient = new QueryClient();

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    // No Privy app id configured — Privy is now the only connect path (RainbowKit removed, see
    // the dashboard IA spec's Connect UX decision), so without it nothing can connect a wallet.
    // Fall back to a bare wagmi provider so the app still renders (reads still work) rather than
    // crashing outright.
    return (
      <BareWagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </BareWagmiProvider>
    );
  }
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#009E60",
          logo: "",
        },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={wagmiConfig}>{children}</PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
