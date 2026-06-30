/**
 * OpenRails shareable links (RailsFlow requests / RailsCard claims).
 *
 * Uses the base64url-JSON envelope format (`serializeEnvelope`), which the SDK's
 * `deserializeOpenRailsLinkArtifact` accepts via its non-compact branch — so links
 * minted here round-trip with the SDK. Route + `#or=<token>` fragment match the SDK.
 */
import { serializeEnvelope, deserializeEnvelope, type OpenRailsEnvelopeMode } from "./intents";

export type OpenRailsLinkKind = "railsflow" | "railscard";

export interface RailsFlowLinkPayload {
  mode: "railsflow";
  merchant: string;
  recipient: string;
  amount: string; // USDC base units
  flowVelocityPerSecond: string;
  lifespanSeconds: number;
  workflowId?: string;
  metadataRef?: string;
  expiresAt?: number;
}

export interface RailsCardLinkPayload {
  mode: Extract<OpenRailsEnvelopeMode, "railscard_bearer" | "railscard_recipient_bound">;
  envelopeToken: string;
  claimHint?: string;
}

export interface OpenRailsLinkArtifact {
  version: "openrails-link-v1";
  kind: OpenRailsLinkKind;
  chainId: number;
  vault: string;
  token: string;
  metadataHash: string;
  payload: RailsFlowLinkPayload | RailsCardLinkPayload;
}

export function createOpenRailsLinkUrl(appBaseUrl: string, artifact: OpenRailsLinkArtifact): string {
  const url = new URL(appBaseUrl);
  url.pathname = artifact.kind === "railsflow" ? "/openrails/flow" : "/openrails/card";
  url.search = "";
  url.hash = `or=${serializeEnvelope(artifact)}`;
  return url.toString();
}

export function createRailsFlowRequestLink(params: {
  appBaseUrl: string;
  chainId: number;
  vault: string;
  token: string;
  metadataHash: string;
  payload: RailsFlowLinkPayload;
}): string {
  return createOpenRailsLinkUrl(params.appBaseUrl, {
    version: "openrails-link-v1",
    kind: "railsflow",
    chainId: params.chainId,
    vault: params.vault,
    token: params.token,
    metadataHash: params.metadataHash,
    payload: params.payload,
  });
}

export function createRailsCardClaimLink(params: {
  appBaseUrl: string;
  chainId: number;
  vault: string;
  token: string;
  metadataHash: string;
  payload: RailsCardLinkPayload;
}): string {
  return createOpenRailsLinkUrl(params.appBaseUrl, {
    version: "openrails-link-v1",
    kind: "railscard",
    chainId: params.chainId,
    vault: params.vault,
    token: params.token,
    metadataHash: params.metadataHash,
    payload: params.payload,
  });
}

/** Accepts a full URL (with `#or=`) or a raw token. */
export function extractLinkToken(input: string): string {
  const v = input.trim();
  if (!v.includes("://") && !v.startsWith("/") && !v.includes("#")) return v; // raw token
  const url = new URL(v, "https://openrails.local");
  const frag = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const token = new URLSearchParams(frag).get("or");
  if (!token) throw new Error("Link is missing the #or= fragment");
  return token;
}

export function parseOpenRailsLink(input: string): OpenRailsLinkArtifact {
  const a = deserializeEnvelope<OpenRailsLinkArtifact>(extractLinkToken(input));
  if (a?.version !== "openrails-link-v1" || (a.kind !== "railsflow" && a.kind !== "railscard")) {
    throw new Error("Not a valid OpenRails link");
  }
  return a;
}

export const appBaseUrl = (): string =>
  typeof window !== "undefined" ? window.location.origin : "https://openrails.local";
