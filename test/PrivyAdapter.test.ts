import { expect } from "chai";
import { ethers } from "ethers";

import {
  LeptonOpenRailsClient,
  OPENRAILS_EIP712_TYPES,
  buildOpenRailsDomain,
  buildSettlementIntentValue,
  type OpenRailsIntentV1,
  type CryptographicEnvelopeV1,
} from "../sdk/src/client";
import { RelayClient, payGasless, claimGasless } from "../sdk/src/relay";
import { privyToAccount, type Eip1193Provider } from "../sdk/src/adapters/privy";

const HUB = "0x01EC54846524D043fD808152D41596beF603381d";
const CHAIN_ID = 5042002;
const B32 = ethers.keccak256(ethers.toUtf8Bytes("privy-adapter-test"));

function makeIntent(recipient: string): OpenRailsIntentV1 {
  return {
    paycardId: B32,
    metadataHash: B32,
    recipient,
    totalAllocationPool: "2000",
    flowVelocityPerSecond: "0",
    genesisTimestamp: Math.floor(Date.now() / 1000),
    lifespanSeconds: 0,
    residualDeltaRecipient: recipient,
    nonceChannel: 0,
    nonceValue: 0,
  };
}

function recoverEnvelopeSigner(token: string): { payerAddress: string; recovered: string } {
  const env = LeptonOpenRailsClient.deserializePayload(token) as CryptographicEnvelopeV1;
  const domain = buildOpenRailsDomain(CHAIN_ID, HUB);
  const value = buildSettlementIntentValue(env.intent as unknown as OpenRailsIntentV1);
  const recovered = ethers.verifyTypedData(domain, OPENRAILS_EIP712_TYPES, value, env.envelopeSignature);
  return { payerAddress: env.payerAddress, recovered };
}

// Wraps a plain ethers.Wallet as a minimal EIP-1193 provider that only understands
// eth_signTypedData_v4 — exactly what a real wallet extension (or Privy's embedded-wallet
// provider) exposes. This inverts privyToAccount()'s signTypedData(): it builds the full
// EIP-712 payload (ethers.TypedDataEncoder.getPayload) and sends it as a JSON string; the
// shim parses it back and re-signs with the wallet, proving the round trip end to end.
function makeMockEip1193Provider(wallet: ethers.Wallet): Eip1193Provider {
  return {
    async request({ method, params }) {
      if (method !== "eth_signTypedData_v4") {
        throw new Error(`unexpected method ${method}`);
      }
      const [address, payloadJson] = params as [string, string];
      if (address.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error("address mismatch");
      }
      const payload = JSON.parse(payloadJson);
      const { EIP712Domain: _EIP712Domain, ...types } = payload.types;
      return wallet.signTypedData(payload.domain, types, payload.message);
    },
  };
}

describe("privyToAccount (mock EIP-1193 provider)", () => {
  it("produces an envelope whose signature recovers to the wallet address", async () => {
    const wallet = ethers.Wallet.createRandom();
    const provider = makeMockEip1193Provider(wallet);
    const account = privyToAccount({ address: wallet.address, provider });

    expect(await account.getAddress()).to.equal(wallet.address);

    const client = await LeptonOpenRailsClient.fromAccount(account, HUB, CHAIN_ID);
    const token = await client.signPermissionEnvelope(makeIntent(wallet.address));

    const { payerAddress, recovered } = recoverEnvelopeSigner(token);
    expect(payerAddress).to.equal(wallet.address);
    expect(recovered).to.equal(wallet.address);
  });

  it("drives payGasless end to end through the relay", async () => {
    const wallet = ethers.Wallet.createRandom();
    const provider = makeMockEip1193Provider(wallet);
    const account = privyToAccount({ address: wallet.address, provider });
    const client = await LeptonOpenRailsClient.fromAccount(account, HUB, CHAIN_ID);

    const calls: Array<{ url: string; body: any }> = [];
    const fetchImpl = async (url: string, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ txHash: "0xabc", paycardId: B32 }) };
    };
    const relay = new RelayClient({ baseUrl: "https://relay.example/", fetchImpl });

    const result = await payGasless({ client, relay, intent: makeIntent(wallet.address) });

    expect(result.txHash).to.equal("0xabc");
    expect(calls[0].url).to.equal("https://relay.example/relay-open");
    const { payerAddress, recovered } = recoverEnvelopeSigner(calls[0].body.envelopeToken);
    expect(payerAddress).to.equal(wallet.address);
    expect(recovered).to.equal(wallet.address);
  });

  it("drives claimGasless end to end through the relay", async () => {
    const wallet = ethers.Wallet.createRandom();
    const provider = makeMockEip1193Provider(wallet);
    const account = privyToAccount({ address: wallet.address, provider });
    const client = await LeptonOpenRailsClient.fromAccount(account, HUB, CHAIN_ID);

    // Bearer RailsCard: recipient signed as address(0), bound to the claimant at claim time.
    const token = await client.signPermissionEnvelope(makeIntent(ethers.ZeroAddress));

    const calls: Array<{ url: string; body: any }> = [];
    const fetchImpl = async (url: string, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ txHash: "0xdef", paycardId: B32 }) };
    };
    const relay = new RelayClient({ baseUrl: "https://relay.example/", fetchImpl });
    const claimRecipient = ethers.Wallet.createRandom().address;

    const result = await claimGasless({ relay, envelopeToken: token, claimRecipient });

    expect(result.txHash).to.equal("0xdef");
    expect(calls[0].url).to.equal("https://relay.example/relay-claim");
    expect(calls[0].body.envelopeToken).to.equal(token);
    expect(calls[0].body.claimRecipient).to.equal(claimRecipient);
  });

  it("does not swallow a provider error", async () => {
    const wallet = ethers.Wallet.createRandom();
    const provider: Eip1193Provider = {
      async request() {
        throw new Error("user rejected the request");
      },
    };
    const account = privyToAccount({ address: wallet.address, provider });
    const client = await LeptonOpenRailsClient.fromAccount(account, HUB, CHAIN_ID);

    let threw = "";
    try {
      await client.signPermissionEnvelope(makeIntent(wallet.address));
    } catch (e) {
      threw = (e as Error).message;
    }
    expect(threw).to.equal("user rejected the request");
  });
});
