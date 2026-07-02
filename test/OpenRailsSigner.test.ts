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
import type { OpenRailsAccount } from "../sdk/src/account";
import { signUsdcPermit } from "../sdk/src/permit";
import { RelayClient, payGasless, claimGasless } from "../sdk/src/relay";
import { ethersToSubmitter } from "../sdk/src/adapters/ethers";

const HUB = "0x01EC54846524D043fD808152D41596beF603381d";
const USDC = "0x3600000000000000000000000000000000000000";
const CHAIN_ID = 5042002;
const B32 = ethers.keccak256(ethers.toUtf8Bytes("openrails-signer-test"));

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

describe("OpenRails signer abstraction", () => {
  it("backward compat: private-key client signs a recoverable envelope", async () => {
    const w = ethers.Wallet.createRandom();
    const client = new LeptonOpenRailsClient(w.privateKey, HUB, CHAIN_ID);
    expect(client.getAddress()).to.equal(w.address);

    const token = await client.signPermissionEnvelope(makeIntent(w.address));
    const { payerAddress, recovered } = recoverEnvelopeSigner(token);
    expect(payerAddress).to.equal(w.address);
    expect(recovered).to.equal(w.address);
  });

  it("fromAccount routes signing through the provided account", async () => {
    const w = ethers.Wallet.createRandom();
    let signCalls = 0;
    const account: OpenRailsAccount = {
      getAddress: async () => w.address,
      signTypedData: async (domain, types, value) => {
        signCalls += 1;
        return w.signTypedData(domain, types, value as Record<string, unknown>);
      },
    };

    const client = await LeptonOpenRailsClient.fromAccount(account, HUB, CHAIN_ID);
    expect(client.getAddress()).to.equal(w.address);

    const token = await client.signPermissionEnvelope(makeIntent(w.address));
    expect(signCalls).to.equal(1); // routed through the account, not a hidden wallet
    const { payerAddress, recovered } = recoverEnvelopeSigner(token);
    expect(payerAddress).to.equal(w.address);
    expect(recovered).to.equal(w.address);
  });

  it("ethersToSubmitter satisfies the interface and signs a recoverable intent", async () => {
    const w = ethers.Wallet.createRandom();
    const submitter = ethersToSubmitter(w);
    expect(await submitter.getAddress()).to.equal(w.address);
    expect(typeof submitter.sendTransaction).to.equal("function");

    const domain = buildOpenRailsDomain(CHAIN_ID, HUB);
    const value = buildSettlementIntentValue(makeIntent(w.address));
    const sig = await submitter.signTypedData(domain, OPENRAILS_EIP712_TYPES, value);
    expect(ethers.verifyTypedData(domain, OPENRAILS_EIP712_TYPES, value, sig)).to.equal(w.address);
  });

  it("signUsdcPermit builds an EIP-2612 permit that recovers the owner (no network)", async () => {
    const w = ethers.Wallet.createRandom();
    const account = ethersToSubmitter(w);

    const permit = await signUsdcPermit(account, {
      token: USDC,
      spender: HUB,
      value: 2000n,
      chainId: CHAIN_ID,
      deadline: 9999999999,
      name: "USD Coin",
      version: "2",
      nonce: 0,
    });

    expect(permit.owner).to.equal(w.address);
    expect(permit.spender).to.equal(ethers.getAddress(HUB));
    expect(permit.value).to.equal("2000");

    // Reconstruct the domain/message and confirm v,r,s recover the owner.
    const domain = { name: "USD Coin", version: "2", chainId: CHAIN_ID, verifyingContract: ethers.getAddress(USDC) };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const message = { owner: w.address, spender: ethers.getAddress(HUB), value: 2000n, nonce: 0n, deadline: 9999999999 };
    const sig = ethers.Signature.from({ r: permit.r, s: permit.s, v: permit.v }).serialized;
    expect(ethers.verifyTypedData(domain, types, message, sig)).to.equal(w.address);
  });

  it("RelayClient posts the right shape; payGasless/claimGasless flow through it", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    const fetchImpl = async (url: string, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ txHash: "0xabc", paycardId: B32 }) };
    };
    const relay = new RelayClient({ baseUrl: "https://relay.example/", fetchImpl });

    const claim = await claimGasless({ relay, envelopeToken: "TOKEN", claimRecipient: "0x00000000000000000000000000000000000000AA" });
    expect(claim.txHash).to.equal("0xabc");
    expect(calls[0].url).to.equal("https://relay.example/relay-claim");
    expect(calls[0].body.envelopeToken).to.equal("TOKEN");

    const w = ethers.Wallet.createRandom();
    const client = new LeptonOpenRailsClient(w.privateKey, HUB, CHAIN_ID);
    const open = await payGasless({ client, relay, intent: makeIntent(w.address) });
    expect(open.txHash).to.equal("0xabc");
    expect(calls[1].url).to.equal("https://relay.example/relay-open");
    expect(typeof calls[1].body.envelopeToken).to.equal("string");
  });

  it("relay surfaces server errors", async () => {
    const fetchImpl = async () => ({ ok: false, status: 409, json: async () => ({ error: "already claimed" }) });
    const relay = new RelayClient({ baseUrl: "https://relay.example", fetchImpl });
    let threw = "";
    try {
      await relay.relayClaim({ envelopeToken: "T" });
    } catch (e) {
      threw = (e as Error).message;
    }
    expect(threw).to.equal("already claimed");
  });
});
