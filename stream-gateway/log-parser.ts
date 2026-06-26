import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A decoded on-chain event with all relevant metadata.
 */
export interface ParsedEvent {
  /** The Solidity event name (e.g. "PaycardProvisioned"). */
  eventName: string;
  /** The `paycardId` extracted from the indexed topic (bytes32 hex). */
  paycardId: string;
  /** All decoded event arguments keyed by name. */
  args: Record<string, any>;
  /** The block that included this log. */
  blockNumber: number;
  /** Block timestamp if the gateway enriched the parsed event. */
  blockTimestamp?: number;
  /** Transaction hash that emitted the log. */
  transactionHash: string;
}

// ---------------------------------------------------------------------------
// ABI event fragments for the ArcOpenRailsHubV1 contract
// ---------------------------------------------------------------------------

/**
 * Canonical event signatures emitted by the clearinghouse contract.
 * Kept as human-readable fragments so the parser is self-contained.
 */
const DEFAULT_EVENT_FRAGMENTS: string[] = [
  "event PaycardProvisioned(bytes32 indexed paycardId, address indexed payer, address indexed recipient, bytes32 metadataHash, uint256 poolAllocation, uint256 flowVelocityPerSecond, uint256 genesisTimestamp, uint256 lifespanSeconds)",
  "event SettlementFlushed(bytes32 indexed paycardId, address indexed recipient, uint256 amountWithdrawn)",
  "event ResidualDeltaReclaimed(bytes32 indexed paycardId, address indexed recoveryVault, uint256 varianceSwept)",
];

// ---------------------------------------------------------------------------
// LogIngestionParser
// ---------------------------------------------------------------------------

/**
 * Decodes raw `ethers.Log` objects into structured {@link ParsedEvent}s.
 *
 * Internally builds an `ethers.Interface` from the provided (or default)
 * event fragments and uses it to match topic0 → event descriptor.
 */
export class LogIngestionParser {
  private readonly iface: ethers.Interface;

  /**
   * @param eventFragments - Human-readable Solidity event signatures.
   *                         Defaults to the three clearinghouse events.
   */
  constructor(eventFragments: string[] = DEFAULT_EVENT_FRAGMENTS) {
    this.iface = new ethers.Interface(eventFragments);
  }

  /**
   * Attempts to parse a raw log entry.
   *
   * @param log - An `ethers.Log` (or compatible object) from a provider.
   * @returns   A {@link ParsedEvent} if the log matches a known event,
   *            otherwise `null`.
   */
  parse(log: ethers.Log): ParsedEvent | null {
    try {
      const parsed = this.iface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (!parsed) return null;

      // Build a plain object from the decoded result.
      const args: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsed.args.toObject())) {
        // Convert BigInt values to strings for safe serialisation.
        args[key] = typeof value === "bigint" ? value.toString() : value;
      }

      // `paycardId` is always the first indexed argument in all three events.
      const paycardId: string =
        (args["paycardId"] as string) ?? log.topics[1] ?? "0x";

      return {
        eventName: parsed.name,
        paycardId,
        args,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      };
    } catch {
      // Log doesn't match any known event – not an error, just irrelevant.
      return null;
    }
  }

  /**
   * Returns the topic0 hashes for all known events.
   * Useful for building subscription topic filters.
   */
  getTopicFilters(): string[] {
    return this.iface.fragments
      .filter((f): f is ethers.EventFragment => f.type === "event")
      .map((f) => this.iface.getEvent(f.name)!.topicHash);
  }
}
