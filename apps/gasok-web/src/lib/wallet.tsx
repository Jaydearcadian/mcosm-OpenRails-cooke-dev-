import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { GIWA } from '../data/giwa';

export type TypedDataEnvelope = {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  primaryType: string;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
};

type Eip1193Provider = {
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type WalletContextValue = {
  address?: Address;
  chainId?: number;
  connecting: boolean;
  authenticating: boolean;
  sessionAddress?: Address;
  publicClient: PublicClient;
  connect: () => Promise<Address>;
  ensureGiwa: () => Promise<void>;
  ensureSession: () => Promise<Address>;
  signMessage: (message: string) => Promise<Hex>;
  signTypedData: (typedData: TypedDataEnvelope) => Promise<Hex>;
  walletClient: () => Promise<BrowserWalletClient>;
};

export const giwaChain = defineChain({
  id: GIWA.chainId,
  name: GIWA.name,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [GIWA.rpcUrl] } },
  blockExplorers: { default: { name: 'GIWA Explorer', url: GIWA.explorerUrl } },
  testnet: true,
});

const publicClient = createPublicClient({ chain: giwaChain, transport: http(GIWA.rpcUrl) });
const WalletContext = createContext<WalletContextValue | null>(null);

function provider(): Eip1193Provider {
  const value = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!value) throw new Error('Install an EVM wallet to use the live GIWA flow.');
  return value;
}

function makeWalletClient(account: Address) {
  return createWalletClient({ account, chain: giwaChain, transport: custom(provider()) });
}

export type BrowserWalletClient = ReturnType<typeof makeWalletClient>;

async function json<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof (value as { error?: unknown }).error === 'string'
      ? (value as { error: string }).error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return value as T;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [connecting, setConnecting] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [sessionAddress, setSessionAddress] = useState<Address>();

  const refresh = useCallback(async () => {
    const p = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    if (!p) return;
    const [accounts, chain] = await Promise.all([
      p.request({ method: 'eth_accounts' }) as Promise<string[]>,
      p.request({ method: 'eth_chainId' }) as Promise<string>,
    ]);
    const nextAddress = accounts[0] as Address | undefined;
    setAddress(nextAddress);
    setChainId(Number.parseInt(chain, 16));
    setSessionAddress((current) => current && nextAddress && current.toLowerCase() === nextAddress.toLowerCase() ? current : undefined);
  }, []);

  useEffect(() => {
    void refresh();
    const p = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    if (!p?.on) return;
    const listener = () => void refresh();
    p.on('accountsChanged', listener);
    p.on('chainChanged', listener);
    return () => {
      p.removeListener?.('accountsChanged', listener);
      p.removeListener?.('chainChanged', listener);
    };
  }, [refresh]);

  const ensureGiwa = useCallback(async () => {
    const p = provider();
    const desired = `0x${GIWA.chainId.toString(16)}`;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: desired }] });
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== 4902 && code !== -32603) throw error;
      await p.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: desired,
          chainName: GIWA.name,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [GIWA.rpcUrl],
          blockExplorerUrls: [GIWA.explorerUrl],
        }],
      });
    }
    setChainId(GIWA.chainId);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const p = provider();
      const accounts = await p.request({ method: 'eth_requestAccounts' }) as string[];
      await ensureGiwa();
      const next = accounts[0] as Address | undefined;
      if (!next) throw new Error('The wallet did not return an account.');
      setAddress(next);
      return next;
    } finally {
      setConnecting(false);
    }
  }, [ensureGiwa]);

  const getWalletClient = useCallback(async () => {
    const account = address ?? await connect();
    await ensureGiwa();
    return makeWalletClient(account);
  }, [address, connect, ensureGiwa]);

  const signMessage = useCallback(async (message: string) => {
    const client = await getWalletClient();
    const account = client.account;
    if (!account) throw new Error('Connect a wallet before signing.');
    return await client.signMessage({ account, message });
  }, [getWalletClient]);

  const signTypedData = useCallback(async (typedData: TypedDataEnvelope) => {
    const client = await getWalletClient();
    const account = client.account;
    if (!account) throw new Error('Connect a wallet before signing.');
    return await client.signTypedData({
      account,
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    } as never);
  }, [getWalletClient]);

  const ensureSession = useCallback(async () => {
    const account = address ?? await connect();
    await ensureGiwa();
    setAuthenticating(true);
    try {
      const status = await json<{ authenticated: boolean; address?: Address }>(await fetch('/api/session', {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      }));
      if (status.authenticated && status.address?.toLowerCase() === account.toLowerCase()) {
        setSessionAddress(account);
        return account;
      }

      const challenge = await json<{ message: string }>(await fetch(`/api/session/challenge?address=${encodeURIComponent(account)}`, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      }));
      const signature = await signMessage(challenge.message);
      const verified = await json<{ authenticated: boolean; address: Address }>(await fetch('/api/session/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: account, signature }),
      }));
      if (!verified.authenticated || verified.address.toLowerCase() !== account.toLowerCase()) {
        throw new Error('The live API session could not be authenticated.');
      }
      setSessionAddress(account);
      return account;
    } finally {
      setAuthenticating(false);
    }
  }, [address, connect, ensureGiwa, signMessage]);

  const value = useMemo<WalletContextValue>(() => ({
    address,
    chainId,
    connecting,
    authenticating,
    sessionAddress,
    publicClient,
    connect,
    ensureGiwa,
    ensureSession,
    signMessage,
    signTypedData,
    walletClient: getWalletClient,
  }), [address, chainId, connecting, authenticating, sessionAddress, connect, ensureGiwa, ensureSession, signMessage, signTypedData, getWalletClient]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet must be used inside WalletProvider');
  return value;
}
