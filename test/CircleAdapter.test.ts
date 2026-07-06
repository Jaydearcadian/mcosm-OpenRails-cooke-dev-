import { expect } from "chai";
import { ethers } from "hardhat";
import { circleToAccount, type CircleLikeSmartAccount } from "../sdk/src/adapters/circle";
import {
  LeptonOpenRailsClient,
  OPENRAILS_EIP712_TYPES,
  buildOpenRailsDomain,
  buildSettlementIntentValue,
  type OpenRailsIntentV1,
  type CryptographicEnvelopeV1,
} from "../sdk/src/client";

const HUB = "0x941C8029F0f912df3fAb7423890ab2359b996D0b"; // V2 canonical hub
const CHAIN_ID = 5042002;
const B32 = ethers.keccak256(ethers.toUtf8Bytes("circle-adapter-test"));

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

describe("circleToAccount (Circle Smart Account Adapter)", () => {
  it("produces a signature that recovers to the owner wallet address (mock/isolation)", async () => {
    const ownerWallet = ethers.Wallet.createRandom();
    
    // Mock the Circle smart account. The address of the smart account in this mock
    // is simply the owner's address for EOA-like recovery testing.
    const mockClient: CircleLikeSmartAccount = {
      address: ownerWallet.address,
      async signTypedData({ domain, types, message }) {
        const { EIP712Domain: _EIP712Domain, ...cleanTypes } = types;
        return ownerWallet.signTypedData(domain, cleanTypes, message);
      },
    };

    const account = circleToAccount(mockClient);
    expect(await account.getAddress()).to.equal(ownerWallet.address);

    const client = await LeptonOpenRailsClient.fromAccount(account, HUB, CHAIN_ID);
    const token = await client.signPermissionEnvelope(makeIntent(ownerWallet.address));

    // Deserialise and verify the typed data signature directly
    const env = LeptonOpenRailsClient.deserializePayload(token) as CryptographicEnvelopeV1;
    const domain = buildOpenRailsDomain(CHAIN_ID, HUB);
    const value = buildSettlementIntentValue(env.intent as unknown as OpenRailsIntentV1);
    
    const recovered = ethers.verifyTypedData(domain, OPENRAILS_EIP712_TYPES, value, env.envelopeSignature);
    expect(env.payerAddress).to.equal(ownerWallet.address);
    expect(recovered).to.equal(ownerWallet.address);
  });

  it("produces a signature validated by MockERC1271Account on-chain (EIP-1271 validation)", async () => {
    const [deployer] = await ethers.getSigners();
    const ownerWallet = ethers.Wallet.createRandom();

    // Deploy MockERC1271Account
    const MockERC1271Account = await ethers.getContractFactory("MockERC1271Account");
    const mockAccountContract = await MockERC1271Account.deploy(ownerWallet.address);
    await mockAccountContract.waitForDeployment();
    const contractAddress = await mockAccountContract.getAddress();

    // Mock Circle smart account pointing to the contract address, but signing with the owner EOA
    const mockClient: CircleLikeSmartAccount = {
      address: contractAddress,
      async signTypedData({ domain, types, message }) {
        const { EIP712Domain: _EIP712Domain, ...cleanTypes } = types;
        return ownerWallet.signTypedData(domain, cleanTypes, message);
      },
    };

    const account = circleToAccount(mockClient);
    expect(await account.getAddress()).to.equal(contractAddress);

    const client = await LeptonOpenRailsClient.fromAccount(account, HUB, CHAIN_ID);
    const token = await client.signPermissionEnvelope(makeIntent(contractAddress));

    const env = LeptonOpenRailsClient.deserializePayload(token) as CryptographicEnvelopeV1;
    const domain = buildOpenRailsDomain(CHAIN_ID, HUB);
    const value = buildSettlementIntentValue(env.intent as unknown as OpenRailsIntentV1);

    // Get the EIP-712 digest
    const digest = ethers.TypedDataEncoder.hash(domain, OPENRAILS_EIP712_TYPES, value);

    // Call isValidSignature on the deployed MockERC1271Account
    const magicValue = await mockAccountContract.isValidSignature(digest, env.envelopeSignature);
    expect(magicValue).to.equal("0x1626ba7e"); // EIP-1271 Magic Value
  });
});
