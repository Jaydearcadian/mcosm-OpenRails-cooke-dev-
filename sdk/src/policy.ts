import { ethers } from 'ethers';
import type { OpenRailsIntentV1 } from './client';

export interface PolicyEnvelopeV1 {
  maxAllocationPool?: string;
  maxFlowVelocityPerSecond?: string;
  maxLifespanSeconds?: number;
  allowWildcardRecipient?: boolean;
  expiresAt?: number;
}

export interface PolicyEvaluationResult {
  approved: boolean;
  reasons: string[];
}

export function evaluatePolicyEnvelope(
  intent: OpenRailsIntentV1,
  policy?: PolicyEnvelopeV1,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): PolicyEvaluationResult {
  const reasons: string[] = [];
  if (!policy) return { approved: true, reasons };

  if (policy.expiresAt !== undefined && nowSeconds > policy.expiresAt) {
    reasons.push('policy_expired');
  }

  if (policy.maxAllocationPool !== undefined) {
    const max = BigInt(policy.maxAllocationPool);
    if (BigInt(intent.totalAllocationPool) > max) reasons.push('allocation_exceeds_policy');
  }

  if (policy.maxFlowVelocityPerSecond !== undefined) {
    const max = BigInt(policy.maxFlowVelocityPerSecond);
    if (BigInt(intent.flowVelocityPerSecond) > max) reasons.push('velocity_exceeds_policy');
  }

  if (
    policy.maxLifespanSeconds !== undefined &&
    intent.lifespanSeconds > policy.maxLifespanSeconds
  ) {
    reasons.push('lifespan_exceeds_policy');
  }

  if (!policy.allowWildcardRecipient && intent.recipient === ethers.ZeroAddress) {
    reasons.push('wildcard_recipient_disallowed');
  }

  return { approved: reasons.length === 0, reasons };
}
