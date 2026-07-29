export const GIWA = {
  name: 'GIWA Sepolia',
  chainId: 91342,
  rpcUrl: 'https://sepolia-rpc.giwa.io',
  explorerUrl: 'https://sepolia-explorer.giwa.io',
  contracts: {
    orUSD: '0x162BCaEb04D4c82403c925d3AC9bEC8FFc1C07De',
    master: '0x21DFc1918FD8c5264F78bA57D861Bc4c1F681dAb',
    factory: '0x5b59b70272A3948eB3F74CFA292f9dB8B64C4d6d',
    vault: '0x623daf607A0C8F841a72012BCE19cfe9E5fbAbf1',
    faucet: '0x86567D16324dB05CABF7c3c4E81cD07F7765a8A4',
  },
  faucet: {
    claimAmount: '1,000 orUSD',
    cooldown: '24 hours',
  },
} as const;
