import { ethers } from "ethers";

export interface OpenRailsIntentV1 {
  paycardId: string;                 // unique bytes32 hex identifier
  recipient: string;                 // target merchant node address
  totalAllocationPool: string;       // base units (including STN-Delta protective buffer)
  flowVelocityPerSecond: string;     // R: consumption rate vector
  genesisTimestamp: number;          // epoch start time
  lifespanSeconds: number;           // total track validity horizon
  residualDeltaRecipient: string;    // target recovery vault for unspent buffer
}

export interface CryptographicEnvelopeV1 {
  payerAddress: string;
  envelopeSignature: string;
  intent: OpenRailsIntentV1;
}

export class OpenRailsArcClient {
  private wallet: ethers.Wallet;
  private contractAddress: string;
  private chainId: number;

  constructor(privateKey: string, contractAddress: string, chainId: number, provider?: ethers.Provider) {
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.contractAddress = contractAddress;
    this.chainId = chainId;
  }

  public getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Generates a fully typed EIP-712 signature matrix matching the Arc Clearinghouse state parameters.
   */
  public async signPermissionEnvelope(intent: OpenRailsIntentV1): Promise<string> {
    const domain = {
      name: "OpenRails Network",
      version: "1.0.0",
      chainId: this.chainId,
      verifyingContract: this.contractAddress,
    };

    const types = {
      SettlementIntent: [
        { name: "paycardId", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "totalAllocationPool", type: "uint256" },
        { name: "flowVelocityPerSecond", type: "uint256" },
        { name: "genesisTimestamp", type: "uint256" },
        { name: "lifespanSeconds", type: "uint256" },
        { name: "residualDeltaRecipient", type: "address" },
      ],
    };

    const value = {
      paycardId: intent.paycardId,
      recipient: intent.recipient,
      totalAllocationPool: intent.totalAllocationPool,
      flowVelocityPerSecond: intent.flowVelocityPerSecond,
      genesisTimestamp: intent.genesisTimestamp,
      lifespanSeconds: intent.lifespanSeconds,
      residualDeltaRecipient: intent.residualDeltaRecipient,
    };

    // Sign using the agent's API-controlled wallet context
    let signature: string;
    if (typeof (this.wallet as any).signTypedData === "function") {
      signature = await (this.wallet as any).signTypedData(domain, types, value);
    } else {
      signature = await (this.wallet as any)._signTypedData(domain, types, value);
    }
    
    const completePayload: CryptographicEnvelopeV1 = {
      payerAddress: this.wallet.address,
      envelopeSignature: signature,
      intent: intent
    };

    // Compress to clean Base64 URL-safe token format for network transmission
    return Buffer.from(JSON.stringify(completePayload), "utf-8")
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  /**
   * Decodes an inbound transport token back into its structured validation elements.
   */
  public static deserializePayload(token: string): CryptographicEnvelopeV1 {
    let base64Normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    while (base64Normalized.length % 4) {
      base64Normalized += "=";
    }
    
    const decodedString = Buffer.from(base64Normalized, "base64").toString("utf-8");
    return JSON.parse(decodedString) as CryptographicEnvelopeV1;
  }
}
