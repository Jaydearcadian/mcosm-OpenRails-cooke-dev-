import { ethers } from "ethers";

import { LeptonOpenRailsClient, type CryptographicEnvelopeV1 } from "../sdk/src/client";
import { evaluatePolicyEnvelope, type PolicyEnvelopeV1 } from "../sdk/src/policy";
import {
  hashOpenRailsMetadata,
  type OpenRailsEnvelopeMode,
} from "../sdk/src/metadata";
import {
  deserializeOpenRailsAccessCredential,
  hashOpenRailsAccessText,
  type OpenRailsAccessCredentialV1,
  verifyOpenRailsAccessCredential,
} from "../sdk/src/access";

export interface OpenPaycardRequestBody {
  envelopeToken?: string;
  claimRecipient?: string;
  policyEnvelope?: PolicyEnvelopeV1;
  mode?: string;
  openRailsPaycardId?: string;
  openRailsMetadataHash?: string;
}

export interface OpenPaycardValidationOptions {
  tokenAddress?: string;
}

export interface OpenPaycardValidationResult {
  decoded: CryptographicEnvelopeV1;
  envelopeMode: OpenRailsEnvelopeMode;
  isWildcardRailsCard: boolean;
  claimRecipient?: string;
  workflowId?: string;
}

export interface OpenRailsAccessValidationHeaders {
  authorization?: string;
  openRailsCredentialType?: string;
  openRailsPaycardId?: string;
  openRailsMetadataHash?: string;
  openRailsMode?: string;
}

export interface OpenRailsAccessValidationOptions {
  expectedChainId: number;
  expectedVault: string;
  expectedService: string;
  expectedServiceOrigin: string;
  expectedScope: string;
  now?: number;
}

export interface OpenRailsAccessValidationResult {
  credential: OpenRailsAccessCredentialV1;
  signer: string;
}

export function validateOpenPaycardRequest(
  body: OpenPaycardRequestBody,
  options: OpenPaycardValidationOptions = {},
): { ok: true; value: OpenPaycardValidationResult } | { ok: false; error: string; reasons?: string[] } {
  const {
    envelopeToken,
    claimRecipient,
    policyEnvelope,
    mode,
    openRailsPaycardId,
    openRailsMetadataHash,
  } = body;
  if (!envelopeToken) {
    return { ok: false, error: "Missing envelopeToken" };
  }

  let decoded: CryptographicEnvelopeV1;
  try {
    decoded = LeptonOpenRailsClient.deserializePayload(envelopeToken);
  } catch {
    return { ok: false, error: "Malformed envelopeToken" };
  }

  const { intent } = decoded;
  if (openRailsPaycardId && openRailsPaycardId !== intent.paycardId) {
    return { ok: false, error: "OpenRails paycard header does not match envelope" };
  }
  if (openRailsMetadataHash && openRailsMetadataHash !== intent.metadataHash) {
    return { ok: false, error: "OpenRails metadata header does not match envelope" };
  }
  if (intent.nonceChannel === undefined || intent.nonceValue === undefined) {
    return { ok: false, error: "Missing nonceChannel or nonceValue" };
  }
  if (!intent.metadataHash || intent.metadataHash === ethers.ZeroHash) {
    return { ok: false, error: "Missing metadataHash" };
  }
  if (decoded.metadata && hashOpenRailsMetadata(decoded.metadata) !== intent.metadataHash) {
    return { ok: false, error: "metadata does not match metadataHash" };
  }

  const policyResult = evaluatePolicyEnvelope(intent, policyEnvelope);
  if (!policyResult.approved) {
    return {
      ok: false,
      error: "Policy preflight rejected envelope",
      reasons: policyResult.reasons,
    };
  }

  const modes = [decoded.metadata?.mode, decoded.mode, mode].filter(
    (value): value is string => value !== undefined,
  );
  const uniqueModes = new Set(modes);
  if (uniqueModes.size > 1) {
    return { ok: false, error: "Conflicting envelope modes" };
  }

  const requestedMode = modes[0];
  const allowedModes = new Set<OpenRailsEnvelopeMode>([
    "railsflow",
    "railscard_bearer",
    "railscard_recipient_bound",
  ]);
  if (
    requestedMode !== undefined &&
    !allowedModes.has(requestedMode as OpenRailsEnvelopeMode)
  ) {
    return { ok: false, error: "Unknown envelope mode" };
  }

  const isWildcardRailsCard = intent.recipient === ethers.ZeroAddress;
  const envelopeMode = (requestedMode ??
    (isWildcardRailsCard ? "railscard_bearer" : "railsflow")) as OpenRailsEnvelopeMode;
  if (envelopeMode === "railscard_bearer" && !isWildcardRailsCard) {
    return { ok: false, error: "Bearer RailsCard requires wildcard recipient" };
  }
  if (envelopeMode === "railsflow" && isWildcardRailsCard) {
    return { ok: false, error: "RailsFlow requires fixed recipient" };
  }
  if (envelopeMode === "railscard_recipient_bound" && isWildcardRailsCard) {
    return { ok: false, error: "Recipient-bound RailsCard requires fixed recipient" };
  }
  if (envelopeMode === "railscard_bearer" && !claimRecipient) {
    return { ok: false, error: "Wildcard RailsCard requires claimRecipient" };
  }
  if (
    envelopeMode === "railscard_bearer" &&
    (!ethers.isAddress(claimRecipient) || claimRecipient === ethers.ZeroAddress)
  ) {
    return { ok: false, error: "Wildcard RailsCard claimRecipient must be a non-zero address" };
  }
  if (envelopeMode === "railscard_recipient_bound" && decoded.metadata?.mode !== "railscard_recipient_bound") {
    return { ok: false, error: "Recipient-bound RailsCard mode must be metadata-bound" };
  }
  if (decoded.metadata) {
    if (decoded.metadata.amount !== intent.totalAllocationPool) {
      return { ok: false, error: "metadata amount does not match intent totalAllocationPool" };
    }
    if (decoded.metadata.flowVelocityPerSecond !== intent.flowVelocityPerSecond) {
      return { ok: false, error: "metadata flowVelocityPerSecond does not match intent" };
    }
    if (decoded.metadata.lifespanSeconds !== intent.lifespanSeconds) {
      return { ok: false, error: "metadata lifespanSeconds does not match intent" };
    }
    const expectedRecipient =
      envelopeMode === "railscard_bearer" ? ethers.ZeroAddress : intent.recipient;
    if (!ethers.isAddress(decoded.metadata.recipient)) {
      return { ok: false, error: "metadata recipient must be an address" };
    }
    if (
      ethers.getAddress(decoded.metadata.recipient) !== ethers.getAddress(expectedRecipient)
    ) {
      return { ok: false, error: "metadata recipient does not match intent mode" };
    }
    if (!ethers.isAddress(decoded.metadata.token)) {
      return { ok: false, error: "metadata token must be an address" };
    }
    if (
      options.tokenAddress &&
      ethers.getAddress(decoded.metadata.token) !== ethers.getAddress(options.tokenAddress)
    ) {
      return { ok: false, error: "metadata token does not match relayer token" };
    }
  }

  return {
    ok: true,
    value: {
      decoded,
      envelopeMode,
      isWildcardRailsCard,
      claimRecipient,
      workflowId: decoded.metadata?.workflowId,
    },
  };
}

export function validateOpenRailsAccessRequest(
  headers: OpenRailsAccessValidationHeaders,
  options: OpenRailsAccessValidationOptions,
): { ok: true; value: OpenRailsAccessValidationResult } | { ok: false; error: string } {
  const authHeader = headers.authorization;
  if (!authHeader?.startsWith("OpenRails ")) {
    return { ok: false, error: "Missing OpenRails access credential" };
  }
  if (headers.openRailsCredentialType && headers.openRailsCredentialType !== "access-v1") {
    return { ok: false, error: "Unsupported OpenRails credential type" };
  }

  let credential: OpenRailsAccessCredentialV1;
  try {
    credential = deserializeOpenRailsAccessCredential(
      authHeader.slice("OpenRails ".length).trim(),
    );
  } catch {
    return { ok: false, error: "Malformed OpenRails access credential" };
  }

  if (credential.chainId !== options.expectedChainId) {
    return { ok: false, error: "OpenRails access credential chain mismatch" };
  }
  if (ethers.getAddress(credential.vault) !== ethers.getAddress(options.expectedVault)) {
    return { ok: false, error: "OpenRails access credential vault mismatch" };
  }
  if (ethers.getAddress(credential.service) !== ethers.getAddress(options.expectedService)) {
    return { ok: false, error: "OpenRails access credential service mismatch" };
  }
  if (credential.serviceOriginHash !== hashOpenRailsAccessText(options.expectedServiceOrigin)) {
    return { ok: false, error: "OpenRails access credential service origin mismatch" };
  }
  if (credential.scopeHash !== hashOpenRailsAccessText(options.expectedScope)) {
    return { ok: false, error: "OpenRails access credential scope mismatch" };
  }
  if (!headers.openRailsPaycardId) {
    return { ok: false, error: "Missing OpenRails access paycard header" };
  }
  if (!headers.openRailsMetadataHash) {
    return { ok: false, error: "Missing OpenRails access metadata header" };
  }
  if (!headers.openRailsMode) {
    return { ok: false, error: "Missing OpenRails access mode header" };
  }
  if (headers.openRailsPaycardId && headers.openRailsPaycardId !== credential.paycardId) {
    return { ok: false, error: "OpenRails access paycard header mismatch" };
  }
  if (headers.openRailsMetadataHash && headers.openRailsMetadataHash !== credential.metadataHash) {
    return { ok: false, error: "OpenRails access metadata header mismatch" };
  }
  if (headers.openRailsMode && headers.openRailsMode !== credential.mode) {
    return { ok: false, error: "OpenRails access mode header mismatch" };
  }

  try {
    const signer = verifyOpenRailsAccessCredential(credential, {
      expectedServiceOrigin: options.expectedServiceOrigin,
      expectedScope: options.expectedScope,
      now: options.now,
    });
    return { ok: true, value: { credential, signer } };
  } catch {
    return { ok: false, error: "Invalid OpenRails access credential signature or lifetime" };
  }
}
