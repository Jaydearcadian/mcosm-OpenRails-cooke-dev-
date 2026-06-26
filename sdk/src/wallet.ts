import { ethers } from 'ethers';

import {
  type CryptographicEnvelopeV1,
  type OpenRailsIntentV1,
  type SignPermissionEnvelopeOptions,
  OPENRAILS_EIP712_TYPES,
  buildOpenRailsDomain,
  buildSettlementIntentValue,
  inferEnvelopeModeFromIntent,
} from './client';
import { hashOpenRailsMetadata } from './metadata';
import { PayloadSerializationError, SignatureVerificationError } from './errors';
import { deserializeEnvelope, serializeEnvelope } from './serialization';

export const OPENRAILS_HUB_ABI = [
  'event SettlementFlushed(bytes32 indexed paycardId,address indexed recipient,uint256 amountWithdrawn)',
  'event ResidualDeltaReclaimed(bytes32 indexed paycardId,address indexed recoveryVault,uint256 varianceSwept)',
  'function registry(bytes32) view returns (address payer,address recipient,bytes32 metadataHash,uint256 totalAllocationPool,uint256 availableBalance,uint256 flowVelocityPerSecond,uint256 genesisTimestamp,uint256 lifespanSeconds,uint256 lastCheckpointEpoch,address residualDeltaRecipient,uint8 operationalStatus)',
  'function accountNonceTracks(address,uint256) view returns (uint256)',
  'function openPaycardChannel(bytes32,bytes32,address,uint256,uint256,uint256,uint256,address,bytes,uint256,uint256)',
  'function claimWildcardPaycardChannel(bytes32,bytes32,address,uint256,uint256,uint256,uint256,address,bytes,uint256,uint256)',
  'function processDripSettle(bytes32)',
  'function flushResidualDelta(bytes32)',
];

export const OPENRAILS_ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function decimals() view returns (uint8)',
];

export interface OpenRailsConfigLike {
  chainId: number;
  clearinghouseAddress: string;
  usdcAddress: string;
}

export interface Eip1193ProviderLike {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface WalletNetworkParams {
  chainId: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls?: string[];
  blockExplorerUrls?: string[];
}

export interface PaycardView {
  payer: string;
  recipient: string;
  metadataHash: string;
  totalAllocationPool: string;
  availableBalance: string;
  flowVelocityPerSecond: string;
  genesisTimestamp: number;
  lifespanSeconds: number;
  lastCheckpointEpoch: number;
  residualDeltaRecipient: string;
  operationalStatus: 'Active' | 'Terminated';
}

export async function assertOpenRailsNetwork(
  provider: ethers.Provider,
  expectedChainId: number,
): Promise<void> {
  const network = await provider.getNetwork();
  const actual = Number(network.chainId);
  if (actual !== expectedChainId) {
    throw new Error(`Wrong network: expected chain ${expectedChainId}, got ${actual}`);
  }
}

export function toEip155ChainIdHex(chainId: number): string {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid chain ID: ${chainId}`);
  }
  return `0x${chainId.toString(16)}`;
}

function isUnrecognizedChainError(err: unknown): boolean {
  const code = (err as { code?: number | string })?.code;
  const message = String((err as { message?: string })?.message ?? "").toLowerCase();
  return code === 4902 || code === "4902" || message.includes("unrecognized chain") || message.includes("unknown chain");
}

export async function switchOrAddOpenRailsNetwork(
  ethereum: Eip1193ProviderLike,
  params: WalletNetworkParams,
): Promise<'switched' | 'added'> {
  const chainId = toEip155ChainIdHex(params.chainId);
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
    return 'switched';
  } catch (err) {
    if (!isUnrecognizedChainError(err)) throw err;
    if (!params.rpcUrls?.length) {
      throw new Error('Wallet does not know this chain and no public RPC URL is configured for wallet_addEthereumChain');
    }
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId,
        chainName: params.chainName,
        nativeCurrency: params.nativeCurrency,
        rpcUrls: params.rpcUrls,
        blockExplorerUrls: params.blockExplorerUrls,
      }],
    });
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
    return 'added';
  }
}

export function getOpenRailsHub(
  runner: ethers.ContractRunner,
  hubAddress: string,
): ethers.Contract {
  return new ethers.Contract(hubAddress, OPENRAILS_HUB_ABI, runner);
}

export function getOpenRailsToken(
  runner: ethers.ContractRunner,
  tokenAddress: string,
): ethers.Contract {
  return new ethers.Contract(tokenAddress, OPENRAILS_ERC20_ABI, runner);
}

export async function readPaycard(
  provider: ethers.Provider,
  hubAddress: string,
  paycardId: string,
): Promise<PaycardView> {
  const card = await getOpenRailsHub(provider, hubAddress).registry(paycardId);
  return {
    payer: card.payer,
    recipient: card.recipient,
    metadataHash: card.metadataHash,
    totalAllocationPool: card.totalAllocationPool.toString(),
    availableBalance: card.availableBalance.toString(),
    flowVelocityPerSecond: card.flowVelocityPerSecond.toString(),
    genesisTimestamp: Number(card.genesisTimestamp),
    lifespanSeconds: Number(card.lifespanSeconds),
    lastCheckpointEpoch: Number(card.lastCheckpointEpoch),
    residualDeltaRecipient: card.residualDeltaRecipient,
    operationalStatus: Number(card.operationalStatus) === 0 ? 'Active' : 'Terminated',
  };
}

export async function readNonce(
  provider: ethers.Provider,
  hubAddress: string,
  payer: string,
  channel: number | bigint,
): Promise<number> {
  const nonce = await getOpenRailsHub(provider, hubAddress).accountNonceTracks(payer, channel);
  return Number(nonce);
}

export async function readTokenBalance(
  provider: ethers.Provider,
  tokenAddress: string,
  owner: string,
): Promise<bigint> {
  return getOpenRailsToken(provider, tokenAddress).balanceOf(owner);
}

export async function readTokenAllowance(
  provider: ethers.Provider,
  tokenAddress: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  return getOpenRailsToken(provider, tokenAddress).allowance(owner, spender);
}

export async function approveOpenRailsSpend(
  signer: ethers.Signer,
  tokenAddress: string,
  spender: string,
  amount: bigint | string,
): Promise<ethers.TransactionResponse> {
  return getOpenRailsToken(signer, tokenAddress).approve(spender, amount);
}

export async function signPermissionEnvelopeWithSigner(
  signer: ethers.Signer,
  config: OpenRailsConfigLike,
  intent: OpenRailsIntentV1,
  options: SignPermissionEnvelopeOptions = {},
): Promise<string> {
  if (intent.nonceChannel === undefined || intent.nonceValue === undefined) {
    throw new PayloadSerializationError('nonceChannel and nonceValue are required', [
      'nonceChannel',
      'nonceValue',
    ]);
  }
  if (options.metadata && hashOpenRailsMetadata(options.metadata) !== intent.metadataHash) {
    throw new PayloadSerializationError('metadata does not match intent.metadataHash', [
      'metadataHash',
    ]);
  }

  const signerAddress = await signer.getAddress();
  const domain = buildOpenRailsDomain(config.chainId, config.clearinghouseAddress);
  const value = buildSettlementIntentValue(intent);
  const signature = await signer.signTypedData(domain, OPENRAILS_EIP712_TYPES, value);
  const recovered = ethers.verifyTypedData(domain, OPENRAILS_EIP712_TYPES, value, signature);
  if (recovered.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new SignatureVerificationError(signerAddress, recovered);
  }

  const envelope: CryptographicEnvelopeV1 = {
    payerAddress: signerAddress,
    envelopeSignature: signature,
    intent,
    mode: options.mode ?? options.metadata?.mode ?? inferEnvelopeModeFromIntent(intent),
    metadata: options.metadata,
  };
  return serializeEnvelope(envelope);
}

export async function submitOpenPaycardWithSigner(
  signer: ethers.Signer,
  hubAddress: string,
  envelopeToken: string,
  mode?: string,
  claimRecipient?: string,
): Promise<ethers.TransactionResponse> {
  const envelope = deserializeEnvelope<CryptographicEnvelopeV1>(envelopeToken);
  const intent = envelope.intent;
  const hub = getOpenRailsHub(signer, hubAddress);
  const resolvedMode = mode ?? envelope.mode ?? inferEnvelopeModeFromIntent(intent);
  const args = [
    intent.paycardId,
    intent.metadataHash,
    resolvedMode === 'railscard_bearer' ? claimRecipient : intent.recipient,
    intent.totalAllocationPool,
    intent.flowVelocityPerSecond,
    intent.genesisTimestamp,
    intent.lifespanSeconds,
    intent.residualDeltaRecipient,
    envelope.envelopeSignature,
    intent.nonceChannel,
    intent.nonceValue,
  ];

  if (resolvedMode === 'railscard_bearer') {
    if (!claimRecipient || !ethers.isAddress(claimRecipient) || claimRecipient === ethers.ZeroAddress) {
      throw new Error('Bearer RailsCard claim requires a non-zero claim recipient');
    }
    return hub.claimWildcardPaycardChannel(...args);
  }
  return hub.openPaycardChannel(...args);
}

export async function submitSettleWithSigner(
  signer: ethers.Signer,
  hubAddress: string,
  paycardId: string,
): Promise<ethers.TransactionResponse> {
  return getOpenRailsHub(signer, hubAddress).processDripSettle(paycardId);
}

export async function submitFlushWithSigner(
  signer: ethers.Signer,
  hubAddress: string,
  paycardId: string,
): Promise<ethers.TransactionResponse> {
  return getOpenRailsHub(signer, hubAddress).flushResidualDelta(paycardId);
}
