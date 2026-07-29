import {
  decodeEventLog,
  encodeAbiParameters,
  formatEther,
  formatUnits,
  keccak256,
  parseAbiParameters,
  parseUnits,
  stringToHex,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import { GIWA } from '../data/giwa';
import type { BrowserWalletClient, TypedDataEnvelope } from './wallet';

export const ORUSD_DECIMALS = 6;
export const LIVE_ALLOCATION = parseUnits('420', ORUSD_DECIMALS);
export const BLOCKED_ALLOCATION = parseUnits('1420', ORUSD_DECIMALS);
export const LIVE_VELOCITY = parseUnits('14', ORUSD_DECIMALS);
export const LIVE_LIFESPAN_SECONDS = 30;
export const PLUGIN_ID = 'giwa_receipt_v1';
export const PLUGIN_VERSION = '1.0.0';

export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

export const faucetAbi = [
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'canClaim', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'nextClaimAt', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'claimAmount', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

export const vaultAbi = [
  { type: 'function', name: 'accountNonceTracks', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'channel', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'openPaycardChannel', stateMutability: 'nonpayable', inputs: [
    { name: 'paycardId', type: 'bytes32' }, { name: 'metadataHash', type: 'bytes32' }, { name: 'recipient', type: 'address' },
    { name: 'totalAllocationPool', type: 'uint256' }, { name: 'flowVelocityPerSecond', type: 'uint256' },
    { name: 'genesisTimestamp', type: 'uint256' }, { name: 'lifespanSeconds', type: 'uint256' },
    { name: 'residualDeltaRecipient', type: 'address' }, { name: 'envelopeSignature', type: 'bytes' },
    { name: 'nonceChannel', type: 'uint256' }, { name: 'nonceValue', type: 'uint256' }, { name: 'payer', type: 'address' },
  ], outputs: [] },
  { type: 'function', name: 'processDripSettle', stateMutability: 'nonpayable', inputs: [{ name: 'paycardId', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'registry', stateMutability: 'view', inputs: [{ name: '', type: 'bytes32' }], outputs: [
    { name: 'payer', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'metadataHash', type: 'bytes32' },
    { name: 'totalAllocationPool', type: 'uint256' }, { name: 'availableBalance', type: 'uint256' },
    { name: 'flowVelocityPerSecond', type: 'uint256' }, { name: 'genesisTimestamp', type: 'uint256' },
    { name: 'lifespanSeconds', type: 'uint256' }, { name: 'lastCheckpointEpoch', type: 'uint256' },
    { name: 'residualDeltaRecipient', type: 'address' }, { name: 'operationalStatus', type: 'uint8' },
  ] },
  { type: 'event', name: 'SettlementFlushed', inputs: [
    { name: 'paycardId', type: 'bytes32', indexed: true }, { name: 'recipient', type: 'address', indexed: true }, { name: 'amountWithdrawn', type: 'uint256', indexed: false },
  ] },
] as const;

export type LiveAccount = {
  blockNumber: bigint;
  nativeBalance: bigint;
  orUsdBalance: bigint;
  faucetReserve: bigint;
  canClaim: boolean;
  nextClaimAt: bigint;
};

export type RailsFlowDraft = {
  metadata: Record<string, unknown>;
  metadataHash: Hex;
  paycardId: Hex;
  intent: {
    paycardId: Hex;
    metadataHash: Hex;
    recipient: Address;
    totalAllocationPool: bigint;
    flowVelocityPerSecond: bigint;
    genesisTimestamp: bigint;
    lifespanSeconds: bigint;
    residualDeltaRecipient: Address;
    nonceChannel: bigint;
    nonceValue: bigint;
  };
  typedData: TypedDataEnvelope;
};

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) output[key] = normalize(entry);
    }
    return output;
  }
  return value;
}

export function buildRailsFlowDraft(input: {
  payer: Address;
  recipient: Address;
  allocation: bigint;
  velocity: bigint;
  genesisTimestamp: bigint;
  lifespanSeconds: bigint;
  nonceChannel: bigint;
  nonceValue: bigint;
  workflowId: string;
  metadataRef: string;
  descriptionHash: Hex;
  salt: string;
}): RailsFlowDraft {
  const metadata = {
    version: 'openrails-metadata-v1',
    mode: 'railsflow',
    originator: input.payer,
    recipient: input.recipient,
    token: GIWA.contracts.orUSD,
    amount: input.allocation.toString(),
    flowVelocityPerSecond: input.velocity.toString(),
    lifespanSeconds: Number(input.lifespanSeconds),
    workflowId: input.workflowId,
    metadataRef: input.metadataRef,
    descriptionHash: input.descriptionHash,
    expiresAt: Number(input.genesisTimestamp + input.lifespanSeconds),
  };
  const metadataHash = keccak256(stringToHex(JSON.stringify(normalize(metadata))));
  const paycardId = keccak256(encodeAbiParameters(
    parseAbiParameters('address, uint256, uint256, bytes32, string'),
    [input.payer, input.nonceChannel, input.nonceValue, metadataHash, input.salt],
  ));
  const intent = {
    paycardId,
    metadataHash,
    recipient: input.recipient,
    totalAllocationPool: input.allocation,
    flowVelocityPerSecond: input.velocity,
    genesisTimestamp: input.genesisTimestamp,
    lifespanSeconds: input.lifespanSeconds,
    residualDeltaRecipient: input.payer,
    nonceChannel: input.nonceChannel,
    nonceValue: input.nonceValue,
  };
  const typedData: TypedDataEnvelope = {
    domain: { name: 'OpenRails Network', version: '2.0.0', chainId: GIWA.chainId, verifyingContract: GIWA.contracts.vault },
    primaryType: 'SettlementIntent',
    types: { SettlementIntent: [
      { name: 'paycardId', type: 'bytes32' }, { name: 'metadataHash', type: 'bytes32' }, { name: 'recipient', type: 'address' },
      { name: 'totalAllocationPool', type: 'uint256' }, { name: 'flowVelocityPerSecond', type: 'uint256' },
      { name: 'genesisTimestamp', type: 'uint256' }, { name: 'lifespanSeconds', type: 'uint256' },
      { name: 'residualDeltaRecipient', type: 'address' }, { name: 'nonceChannel', type: 'uint256' }, { name: 'nonceValue', type: 'uint256' },
    ] },
    message: intent,
  };
  return { metadata, metadataHash, paycardId, intent, typedData };
}

export async function readLiveAccount(publicClient: PublicClient, address: Address): Promise<LiveAccount> {
  const [blockNumber, nativeBalance, orUsdBalance, faucetReserve, canClaim, nextClaimAt] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.getBalance({ address }),
    publicClient.readContract({ address: GIWA.contracts.orUSD, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
    publicClient.readContract({ address: GIWA.contracts.orUSD, abi: erc20Abi, functionName: 'balanceOf', args: [GIWA.contracts.faucet] }),
    publicClient.readContract({ address: GIWA.contracts.faucet, abi: faucetAbi, functionName: 'canClaim', args: [address] }),
    publicClient.readContract({ address: GIWA.contracts.faucet, abi: faucetAbi, functionName: 'nextClaimAt', args: [address] }),
  ]);
  return { blockNumber, nativeBalance, orUsdBalance, faucetReserve, canClaim, nextClaimAt };
}

export function formatOrUsd(value: bigint) { return `${formatUnits(value, ORUSD_DECIMALS)} orUSD`; }
export function formatNative(value: bigint) { return `${Number(formatEther(value)).toFixed(5)} ETH`; }

export async function claimOrUsd(wallet: BrowserWalletClient, publicClient: PublicClient, account: Address): Promise<Hash> {
  const hash = await wallet.writeContract({ account, address: GIWA.contracts.faucet, abi: faucetAbi, functionName: 'claim' });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function ensureApproval(wallet: BrowserWalletClient, publicClient: PublicClient, account: Address, amount: bigint): Promise<Hash | undefined> {
  const allowance = await publicClient.readContract({ address: GIWA.contracts.orUSD, abi: erc20Abi, functionName: 'allowance', args: [account, GIWA.contracts.vault] });
  if (allowance >= amount) return undefined;
  const hash = await wallet.writeContract({ account, address: GIWA.contracts.orUSD, abi: erc20Abi, functionName: 'approve', args: [GIWA.contracts.vault, amount] });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export function settledAmount(receipt: TransactionReceipt, paycardId: Hex): bigint {
  let total = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== GIWA.contracts.vault.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === 'SettlementFlushed' && decoded.args.paycardId.toLowerCase() === paycardId.toLowerCase()) total += decoded.args.amountWithdrawn;
    } catch { /* unrelated vault log */ }
  }
  return total;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `Request failed (${response.status})`);
  return body as T;
}
