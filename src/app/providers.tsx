"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@near-wallet-selector/modal-ui/styles.css";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import {
  type SetupParams,
  WalletSelectorProvider,
} from "@near-wallet-selector/react-hook";
import { nearNetworkId } from "@/constants";

const walletSelectorConfig: SetupParams = {
  network: nearNetworkId,
  modules: [setupMyNearWallet()],
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletSelectorProvider config={walletSelectorConfig}>
        {children}
      </WalletSelectorProvider>
    </QueryClientProvider>
  );
}
