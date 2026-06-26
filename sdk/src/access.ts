import { ethers } from 'ethers';

import type { OpenRailsEnvelopeMode } from './metadata';
import { deserializeEnvelope, serializeEnvelope } from './serialization';

export interface OpenRailsAccessCredentialV1 {
  version: 'openrails-access-v1';
  chainId: number;
  vault: string;
  paycardId: string;
  metadataHash: string;
  mode: OpenRailsEnvelopeMode;
  service: string;
  serviceOriginHash: string;
  scopeHash: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signer: string;
  signature: string;
}

export interface OpenRailsAccessCredentialParams {
  chainId: number;
  vault: string;
  paycardId: string;
  metadataHash: string;
  mode: OpenRailsEnvelopeMode;
  service: string;
  serviceOrigin: string;
  scope: string;
  issuedAt: number;
  expiresAt: number;
  nonce?: string;
}

export const OPENRAILS_ACCESS_TYPES = {
  OpenRailsAccessCredential: [
    { name: 'paycardId', type: 'bytes32' },
    { name: 'metadataHash', type: 'bytes32' },
    { name: 'mode', type: 'string' },
    { name: 'service', type: 'address' },
    { name: 'serviceOriginHash', type: 'bytes32' },
    { name: 'scopeHash', type: 'bytes32' },
    { name: 'issuedAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

export function hashOpenRailsAccessText(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

export function buildOpenRailsAccessDomain(
  chainId: number,
  verifyingContract: string,
): ethers.TypedDataDomain {
  return {
    name: 'OpenRails Access',
    version: '1.0.0',
    chainId,
    verifyingContract,
  };
}

export function buildOpenRailsAccessValue(params: OpenRailsAccessCredentialParams) {
  return {
    paycardId: params.paycardId,
    metadataHash: params.metadataHash,
    mode: params.mode,
    service: params.service,
    serviceOriginHash: hashOpenRailsAccessText(params.serviceOrigin),
    scopeHash: hashOpenRailsAccessText(params.scope),
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    nonce: params.nonce ?? ethers.hexlify(ethers.randomBytes(32)),
  };
}

export async function createOpenRailsAccessCredential(
  signer: ethers.Signer,
  params: OpenRailsAccessCredentialParams,
): Promise<OpenRailsAccessCredentialV1> {
  validateAccessParams(params);
  const value = buildOpenRailsAccessValue(params);
  const domain = buildOpenRailsAccessDomain(params.chainId, params.vault);
  const signature = await signer.signTypedData(domain, OPENRAILS_ACCESS_TYPES, value);
  const signerAddress = await signer.getAddress();

  return {
    version: 'openrails-access-v1',
    chainId: params.chainId,
    vault: params.vault,
    paycardId: params.paycardId,
    metadataHash: params.metadataHash,
    mode: params.mode,
    service: params.service,
    serviceOriginHash: value.serviceOriginHash,
    scopeHash: value.scopeHash,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    nonce: value.nonce,
    signer: signerAddress,
    signature,
  };
}

export function serializeOpenRailsAccessCredential(
  credential: OpenRailsAccessCredentialV1,
): string {
  validateAccessCredentialShape(credential);
  return serializeEnvelope(credential);
}

export function deserializeOpenRailsAccessCredential(
  token: string,
): OpenRailsAccessCredentialV1 {
  const credential = deserializeEnvelope<OpenRailsAccessCredentialV1>(token);
  validateAccessCredentialShape(credential);
  return credential;
}

export function verifyOpenRailsAccessCredential(
  credential: OpenRailsAccessCredentialV1,
  options: {
    expectedServiceOrigin?: string;
    expectedScope?: string;
    now?: number;
  } = {},
): string {
  validateAccessCredentialShape(credential);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (credential.expiresAt <= now) throw new Error('OpenRails access credential expired');
  if (credential.issuedAt > now + 60) throw new Error('OpenRails access credential issued in the future');
  if (
    options.expectedServiceOrigin &&
    credential.serviceOriginHash !== hashOpenRailsAccessText(options.expectedServiceOrigin)
  ) {
    throw new Error('OpenRails access credential service origin mismatch');
  }
  if (
    options.expectedScope &&
    credential.scopeHash !== hashOpenRailsAccessText(options.expectedScope)
  ) {
    throw new Error('OpenRails access credential scope mismatch');
  }

  const recovered = ethers.verifyTypedData(
    buildOpenRailsAccessDomain(credential.chainId, credential.vault),
    OPENRAILS_ACCESS_TYPES,
    {
      paycardId: credential.paycardId,
      metadataHash: credential.metadataHash,
      mode: credential.mode,
      service: credential.service,
      serviceOriginHash: credential.serviceOriginHash,
      scopeHash: credential.scopeHash,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      nonce: credential.nonce,
    },
    credential.signature,
  );
  if (recovered.toLowerCase() !== credential.signer.toLowerCase()) {
    throw new Error('OpenRails access credential signer mismatch');
  }
  return recovered;
}

export function buildOpenRailsAccessHeaders(
  credential: OpenRailsAccessCredentialV1 | string,
): Record<string, string> {
  const parsed =
    typeof credential === 'string'
      ? deserializeOpenRailsAccessCredential(credential)
      : credential;
  const token =
    typeof credential === 'string'
      ? credential
      : serializeOpenRailsAccessCredential(credential);

  return {
    Authorization: `OpenRails ${token}`,
    'X-OpenRails-Credential-Type': 'access-v1',
    'X-OpenRails-Paycard-Id': parsed.paycardId,
    'X-OpenRails-Metadata-Hash': parsed.metadataHash,
    'X-OpenRails-Mode': parsed.mode,
  };
}

export function createOpenRailsFetch(params: {
  credential: OpenRailsAccessCredentialV1 | string;
  allowedOrigins: string[];
  fetchImpl?: typeof fetch;
}): typeof fetch {
  const allowed = new Set(params.allowedOrigins.map(normalizeOrigin));
  const fetchImpl = params.fetchImpl ?? fetch;
  const headers = buildOpenRailsAccessHeaders(params.credential);

  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
    );
    const origin = normalizeOrigin(url.origin);
    if (!allowed.has(origin)) {
      throw new Error(`OpenRails interceptor blocked non-allowlisted origin: ${origin}`);
    }
    if (url.protocol !== 'https:' && !origin.startsWith('http://localhost') && !origin.startsWith('http://127.0.0.1')) {
      throw new Error('OpenRails interceptor requires HTTPS outside localhost');
    }

    const merged = new Headers(init.headers ?? {});
    for (const [key, value] of Object.entries(headers)) merged.set(key, value);
    return fetchImpl(input, {
      ...init,
      redirect: init.redirect ?? 'error',
      headers: merged,
    });
  }) as typeof fetch;
}

function validateAccessParams(params: OpenRailsAccessCredentialParams): void {
  if (params.expiresAt <= params.issuedAt) {
    throw new Error('OpenRails access credential expiresAt must be after issuedAt');
  }
  if (!ethers.isAddress(params.vault) || params.vault === ethers.ZeroAddress) {
    throw new Error('OpenRails access credential vault must be a non-zero address');
  }
  if (!ethers.isAddress(params.service) || params.service === ethers.ZeroAddress) {
    throw new Error('OpenRails access credential service must be a non-zero address');
  }
  if (!ethers.isHexString(params.paycardId, 32)) {
    throw new Error('OpenRails access credential paycardId must be bytes32');
  }
  if (!ethers.isHexString(params.metadataHash, 32)) {
    throw new Error('OpenRails access credential metadataHash must be bytes32');
  }
}

function validateAccessCredentialShape(credential: OpenRailsAccessCredentialV1): void {
  if (credential.version !== 'openrails-access-v1') {
    throw new Error('Unsupported OpenRails access credential version');
  }
  validateAccessParams({
    chainId: credential.chainId,
    vault: credential.vault,
    paycardId: credential.paycardId,
    metadataHash: credential.metadataHash,
    mode: credential.mode,
    service: credential.service,
    serviceOrigin: 'shape-only',
    scope: 'shape-only',
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    nonce: credential.nonce,
  });
  if (!ethers.isAddress(credential.signer) || credential.signer === ethers.ZeroAddress) {
    throw new Error('OpenRails access credential signer must be a non-zero address');
  }
  if (!ethers.isHexString(credential.nonce, 32)) {
    throw new Error('OpenRails access credential nonce must be bytes32');
  }
  if (!ethers.isHexString(credential.serviceOriginHash, 32)) {
    throw new Error('OpenRails access credential serviceOriginHash must be bytes32');
  }
  if (!ethers.isHexString(credential.scopeHash, 32)) {
    throw new Error('OpenRails access credential scopeHash must be bytes32');
  }
}

function normalizeOrigin(origin: string): string {
  return new URL(origin).origin;
}
