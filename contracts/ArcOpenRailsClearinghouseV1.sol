// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title OpenRails V1 Core Clearinghouse Ledger (Arc Network Deployment)
 * @author STN-Delta Engine Group & OpenRails Architecture Labs
 */
interface IERC20_ArcGas {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ArcOpenRailsClearinghouseV1 {
    // --- Constant Event Log Matrix ---
    event PaycardProvisioned(bytes32 indexed paycardId, address indexed payer, address indexed recipient, uint256 poolAllocation);
    event SettlementFlushed(bytes32 indexed paycardId, address indexed recipient, uint256 amountWithdrawn);
    event ResidualDeltaReclaimed(bytes32 indexed paycardId, address indexed recoveryVault, uint256 varianceSwept);

    // --- Structural Guard Failures ---
    error TimeWindowClosed();
    error AccessViolation();
    error CryptographicCollision();
    error BalanceExhausted();

    enum ChannelStatus { Active, Terminated }

    struct PaycardRegistry {
        address payer;
        address recipient;
        uint256 totalAllocationPool;     // Principal + STN-Delta Over-Provision Buffer
        uint256 availableBalance;        // Dynamic unspent dollar state
        uint256 flowVelocityPerSecond;   // R: Continuous drain rate vector
        uint256 genesisTimestamp;        // Active tracking epoch start
        uint256 lifespanSeconds;         // Structural expiration horizon
        uint256 lastCheckpointEpoch;     // Microsecond tracking marker
        address residualDeltaRecipient;  // STN-Delta recovery address vault
        ChannelStatus operationalStatus;
    }

    // Native USDC gas-token address constant on the Arc L1 substrate
    IERC20_ArcGas public immutable arcUsdc;
    
    // Global map of unique, one-time Paycard cryptographic hashes to active states
    mapping(bytes32 => PaycardRegistry) public registry;

    // EIP-712 Structural Schema Signatures
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 private constant ENVELOPE_TYPEHASH = keccak256(
        "SettlementIntent(bytes32 paycardId,address recipient,uint256 totalAllocationPool,uint256 flowVelocityPerSecond,uint256 genesisTimestamp,uint256 lifespanSeconds,address residualDeltaRecipient)"
    );

    constructor(address _arcUsdcNativeGasAddress) {
        arcUsdc = IERC20_ArcGas(_arcUsdcNativeGasAddress);
        
        uint256 chainId;
        assembly { chainId := chainid() }
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("OpenRails Network"),
            keccak256("1.0.0"),
            chainId,
            address(this)
        ));
    }

    /**
     * @notice Ingests an off-chain signed Permission Envelope, escrows funds, and opens an isolated Paycard.
     */
    function openPaycardChannel(
        bytes32 paycardId,
        address recipient,
        uint256 totalAllocationPool,
        uint256 flowVelocityPerSecond,
        uint256 genesisTimestamp,
        uint256 lifespanSeconds,
        address residualDeltaRecipient,
        bytes calldata envelopeSignature
    ) external {
        if (registry[paycardId].payer != address(0)) revert CryptographicCollision();
        if (block.timestamp >= genesisTimestamp + lifespanSeconds) revert TimeWindowClosed();

        // 1. Reconstruct EIP-712 Signature matrix to extract Payer identity
        bytes32 structHash = keccak256(abi.encode(
            ENVELOPE_TYPEHASH, paycardId, recipient, totalAllocationPool, flowVelocityPerSecond, genesisTimestamp, lifespanSeconds, residualDeltaRecipient
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        
        // Inline ECDSA recovery
        address payer = _recoverSigner(digest, envelopeSignature);

        // 2. Lock structural allocation directly inside the contract's dollar escrow vault
        require(arcUsdc.transferFrom(payer, address(this), totalAllocationPool), "USDC Escrow Failed");

        // 3. Instantiate the isolated ledger row
        registry[paycardId] = PaycardRegistry({
            payer: payer,
            recipient: recipient,
            totalAllocationPool: totalAllocationPool,
            availableBalance: totalAllocationPool,
            flowVelocityPerSecond: flowVelocityPerSecond,
            genesisTimestamp: genesisTimestamp,
            lifespanSeconds: lifespanSeconds,
            lastCheckpointEpoch: genesisTimestamp,
            residualDeltaRecipient: residualDeltaRecipient,
            operationalStatus: ChannelStatus.Active
        });

        emit PaycardProvisioned(paycardId, payer, recipient, totalAllocationPool);
    }

    /**
     * @notice Reactive Drip Engine. Computes elapsed block time and settles precise volume debt.
     */
    function processDripSettle(bytes32 paycardId) external {
        PaycardRegistry storage card = registry[paycardId];
        if (card.operationalStatus != ChannelStatus.Active) revert AccessViolation();
        if (block.timestamp <= card.lastCheckpointEpoch) return;

        uint256 staticHorizon = card.genesisTimestamp + card.lifespanSeconds;
        uint256 evaluatedEpoch = block.timestamp > staticHorizon ? staticHorizon : block.timestamp;

        // Linear volume calculation
        uint256 elapsedDelta = evaluatedEpoch - card.lastCheckpointEpoch;
        uint256 accruedDebt = elapsedDelta * card.flowVelocityPerSecond;

        if (accruedDebt >= card.availableBalance) {
            // Pool completely depleted - execute absolute flush
            uint256 finalPayout = card.availableBalance;
            card.availableBalance = 0;
            card.operationalStatus = ChannelStatus.Terminated;
            
            require(arcUsdc.transfer(card.recipient, finalPayout), "Payout Settle Failed");
            emit SettlementFlushed(paycardId, card.recipient, finalPayout);
        } else {
            // Linear segment draw down
            card.availableBalance -= accruedDebt;
            card.lastCheckpointEpoch = evaluatedEpoch;
            
            require(arcUsdc.transfer(card.recipient, accruedDebt), "Payout Settle Failed");
            emit SettlementFlushed(paycardId, card.recipient, accruedDebt);
        }
    }

    /**
     * @notice STN-Delta Residual Core: Snaps unspent safety variances back to the payer instantly.
     */
    function flushResidualDelta(bytes32 paycardId) external {
        PaycardRegistry storage card = registry[paycardId];
        if (msg.sender != card.payer && msg.sender != card.recipient) revert AccessViolation();
        if (card.operationalStatus == ChannelStatus.Terminated) revert AccessViolation();

        uint256 residualDelta = card.availableBalance;
        card.availableBalance = 0;
        card.operationalStatus = ChannelStatus.Terminated;

        if (residualDelta > 0) {
            // Atomic separation split: returns variance instantly to raw corporate treasury balance sheets
            require(arcUsdc.transfer(card.residualDeltaRecipient, residualDelta), "STN-Delta Routing Failure");
            emit ResidualDeltaReclaimed(paycardId, card.residualDeltaRecipient, residualDelta);
        }
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) revert AccessViolation();
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        return ecrecover(digest, v, r, s);
    }
}
