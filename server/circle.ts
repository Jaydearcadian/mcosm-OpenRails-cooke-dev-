/**
 * @module circle
 *
 * **⚠️  HACKATHON DEMO STUBS — NOT FOR PRODUCTION USE ⚠️**
 *
 * This module provides structural integration stubs for the
 * Circle Programmable Wallets API and keyless-signature forwarding
 * service.  Every public method returns hard-coded mock data and
 * logs a reminder that it is a stub.
 *
 * Replace the implementations with real Circle SDK calls once
 * API keys and environment credentials are available.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stub wallet representation returned by {@link CircleWalletManager}. */
export interface CircleWallet {
  walletId: string;
  userId: string;
  address: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** Stub balance record returned by {@link CircleWalletManager.getWalletBalance}. */
export interface WalletBalance {
  walletId: string;
  /** Human-readable USDC balance (e.g. "100.00"). */
  usdcBalance: string;
  /** Native gas token balance. */
  nativeBalance: string;
}

// ---------------------------------------------------------------------------
// CircleWalletManager
// ---------------------------------------------------------------------------

/**
 * **STUB** — Circle Programmable Wallets manager.
 *
 * Exposes `initialize`, `createWallet`, and `getWalletBalance` methods that
 * return deterministic mock data.  Intended as a drop-in placeholder so the
 * rest of the gateway can be wired up ahead of real Circle integration.
 *
 * @remarks This is a hackathon demo stub.  All methods log to the console
 * and return synthetic data.
 */
export class CircleWalletManager {
  private initialized = false;

  /**
   * Initialise the Circle SDK client.
   *
   * **STUB** — logs the call and marks the manager as initialised.
   *
   * @param apiKey - Circle API key (ignored in stub).
   */
  async initialize(apiKey: string): Promise<void> {
    console.log(
      `[CircleWalletManager][STUB] initialize() called with apiKey="${apiKey.slice(0, 6)}…". ` +
        "This is a demo stub — no real Circle SDK initialisation is performed."
    );
    this.initialized = true;
  }

  /**
   * Provision a new programmable wallet for a user.
   *
   * **STUB** — returns a synthetic {@link CircleWallet} without calling Circle.
   *
   * @param userId - Application-level user identifier.
   * @returns A promise resolving to a stub wallet object.
   */
  async createWallet(userId: string): Promise<CircleWallet> {
    console.log(
      `[CircleWalletManager][STUB] createWallet("${userId}") called. ` +
        "Returning mock wallet data."
    );

    return {
      walletId: `circle-wallet-${userId}-${Date.now()}`,
      userId,
      address: "0x" + "a1b2c3d4e5f6".repeat(3).slice(0, 40),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieve the current balances for a wallet.
   *
   * **STUB** — returns fixed demo balances.
   *
   * @param walletId - Circle wallet identifier.
   * @returns A promise resolving to a stub {@link WalletBalance}.
   */
  async getWalletBalance(walletId: string): Promise<WalletBalance> {
    console.log(
      `[CircleWalletManager][STUB] getWalletBalance("${walletId}") called. ` +
        "Returning mock balance data."
    );

    return {
      walletId,
      usdcBalance: "100.00",
      nativeBalance: "0.05",
    };
  }
}

// ---------------------------------------------------------------------------
// KeylessSignatureForwarder
// ---------------------------------------------------------------------------

/**
 * **STUB** — Forwards EIP-712 digests to Circle's keyless signing service.
 *
 * In production this would communicate with Circle's secure enclave to
 * produce an ECDSA signature without the private key ever leaving Circle
 * infrastructure.
 *
 * @remarks This is a hackathon demo stub.  The returned signature is a
 * deterministic 65-byte hex string that will **not** verify on-chain.
 */
export class KeylessSignatureForwarder {
  /**
   * Forward a message digest for remote signing.
   *
   * **STUB** — returns a synthetic 65-byte (130 hex char) signature.
   *
   * @param digest   - The 32-byte hex digest to sign.
   * @param walletId - The Circle wallet that should produce the signature.
   * @returns A promise resolving to a `0x`-prefixed 65-byte hex signature.
   */
  async forwardForSigning(
    digest: string,
    walletId: string
  ): Promise<string> {
    console.log(
      `[KeylessSignatureForwarder][STUB] forwardForSigning() called. ` +
        `digest="${digest.slice(0, 10)}…", walletId="${walletId}". ` +
        "Returning mock 65-byte signature."
    );

    // 65 bytes = 130 hex chars.  We build a recognisable but invalid sig.
    const r = "aa".repeat(32); // 32 bytes
    const s = "bb".repeat(32); // 32 bytes
    const v = "1b";            //  1 byte  (recovery id 27)
    return `0x${r}${s}${v}`;
  }
}
