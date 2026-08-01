import { GIWA } from './giwa';

export type OpenRailsNetworkConfig = {
  slug: string;
  displayLabel: string;
  shortName: string;
  environment: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  settlementAsset: { symbol: string; address: string; decimals: number };
  contracts: typeof GIWA.contracts;
};

export const ACTIVE_NETWORK: OpenRailsNetworkConfig = {
  slug: 'giwa-sepolia',
  displayLabel: 'GIWA / SEPOLIA',
  shortName: 'GIWA',
  environment: 'SEPOLIA',
  chainId: GIWA.chainId,
  rpcUrl: GIWA.rpcUrl,
  explorerUrl: GIWA.explorerUrl,
  nativeCurrency: { name: 'GIWA Sepolia Ether', symbol: 'ETH', decimals: 18 },
  settlementAsset: { symbol: 'orUSD', address: GIWA.contracts.orUSD, decimals: 6 },
  contracts: GIWA.contracts,
};
