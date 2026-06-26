// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../../contracts/ArcOpenRailsHubV1.sol";
import "../../contracts/MockUSDC.sol";

interface VmInvariant {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
}

contract InvariantAssertions {
    VmInvariant internal constant vm = VmInvariant(address(uint160(uint256(keccak256("hevm cheat code")))));

    function _bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        require(min <= max, "bad bounds");
        if (value < min) return min;
        if (value > max) return min + (value % (max - min + 1));
        return value;
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        require(actual == expected, message);
    }

    function assertTrue(bool condition, string memory message) internal pure {
        require(condition, message);
    }
}

contract ArcOpenRailsHubV1InvariantHandler is InvariantAssertions {
    ArcOpenRailsHubV1 public hub;
    MockUSDC public usdc;

    uint256 internal payerPrivateKey;
    address public payer;
    address public recipient;
    address public recovery;

    uint256 public totalOpenedAllocation;
    uint256 public openCounter;
    bytes32[] public paycardIds;

    bytes32 internal constant ENVELOPE_TYPEHASH = keccak256(
        "SettlementIntent(bytes32 paycardId,bytes32 metadataHash,address recipient,uint256 totalAllocationPool,uint256 flowVelocityPerSecond,uint256 genesisTimestamp,uint256 lifespanSeconds,address residualDeltaRecipient,uint256 nonceChannel,uint256 nonceValue)"
    );

    constructor() {
        usdc = new MockUSDC();
        hub = new ArcOpenRailsHubV1(address(usdc));
        payerPrivateKey = 0xB0B;
        payer = vm.addr(payerPrivateKey);
        recipient = address(0x5151);
        recovery = address(0x5252);

        usdc.mint(payer, 100_000_000 * 1e6);
        vm.prank(payer);
        usdc.approve(address(hub), type(uint256).max);
        vm.warp(1_800_000_000);
    }

    function openStream(uint256 allocationSeed, uint256 velocitySeed, uint256 lifespanSeed, uint256 channelSeed) external {
        uint256 allocation = _bound(allocationSeed, 1 * 1e6, 10_000 * 1e6);
        uint256 velocity = _bound(velocitySeed, 1, 10 * 1e6);
        uint256 lifespan = _bound(lifespanSeed, 1, 30 days);
        uint256 channel = _bound(channelSeed, 0, 31);
        uint256 nonceValue = hub.accountNonceTracks(payer, channel);
        bytes32 paycardId = keccak256(abi.encode("invariant", openCounter++, channel, nonceValue));
        bytes32 metadataHash = keccak256(abi.encode("metadata", paycardId));
        uint256 genesis = block.timestamp;
        bytes memory signature = _signIntent(
            paycardId,
            metadataHash,
            recipient,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            channel,
            nonceValue
        );

        try hub.openPaycardChannel(
            paycardId,
            metadataHash,
            recipient,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            signature,
            channel,
            nonceValue
        ) {
            paycardIds.push(paycardId);
            totalOpenedAllocation += allocation;
        } catch {}
    }

    function settle(uint256 indexSeed, uint256 elapsedSeed) external {
        if (paycardIds.length == 0) return;
        uint256 index = _bound(indexSeed, 0, paycardIds.length - 1);
        uint256 elapsed = _bound(elapsedSeed, 0, 3 days);
        vm.warp(block.timestamp + elapsed);
        try hub.processDripSettle(paycardIds[index]) {} catch {}
    }

    function flush(uint256 indexSeed, uint256 elapsedSeed, bool asRecipient) external {
        if (paycardIds.length == 0) return;
        uint256 index = _bound(indexSeed, 0, paycardIds.length - 1);
        uint256 elapsed = _bound(elapsedSeed, 0, 3 days);
        vm.warp(block.timestamp + elapsed);
        vm.prank(asRecipient ? recipient : payer);
        try hub.flushResidualDelta(paycardIds[index]) {} catch {}
    }

    function paycardCount() external view returns (uint256) {
        return paycardIds.length;
    }

    function paycardAt(uint256 index) external view returns (bytes32) {
        return paycardIds[index];
    }

    function _signIntent(
        bytes32 paycardId,
        bytes32 metadataHash,
        address signedRecipient,
        uint256 allocation,
        uint256 velocity,
        uint256 genesis,
        uint256 lifespan,
        address residualRecipient,
        uint256 channel,
        uint256 nonceValue
    ) internal returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                ENVELOPE_TYPEHASH,
                paycardId,
                metadataHash,
                signedRecipient,
                allocation,
                velocity,
                genesis,
                lifespan,
                residualRecipient,
                channel,
                nonceValue
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", hub.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}

contract ArcOpenRailsHubV1InvariantTest is InvariantAssertions {
    ArcOpenRailsHubV1InvariantHandler public handler;

    function setUp() public {
        handler = new ArcOpenRailsHubV1InvariantHandler();
    }

    function openStream(uint256 allocationSeed, uint256 velocitySeed, uint256 lifespanSeed, uint256 channelSeed) external {
        handler.openStream(allocationSeed, velocitySeed, lifespanSeed, channelSeed);
    }

    function settle(uint256 indexSeed, uint256 elapsedSeed) external {
        handler.settle(indexSeed, elapsedSeed);
    }

    function flush(uint256 indexSeed, uint256 elapsedSeed, bool asRecipient) external {
        handler.flush(indexSeed, elapsedSeed, asRecipient);
    }

    function invariant_ConservesManagedCapital() public view {
        ArcOpenRailsHubV1 hub = handler.hub();
        uint256 availableSum = 0;
        uint256 count = handler.paycardCount();

        for (uint256 i = 0; i < count; i++) {
            bytes32 paycardId = handler.paycardAt(i);
            (
                ,
                ,
                ,
                ,
                uint256 availableBalance,
                ,
                uint256 genesisTimestamp,
                uint256 lifespanSeconds,
                uint256 lastCheckpointEpoch,
                ,
                ArcOpenRailsHubV1.ChannelStatus operationalStatus
            ) = hub.registry(paycardId);
            availableSum += availableBalance;
            if (operationalStatus == ArcOpenRailsHubV1.ChannelStatus.Terminated) {
                assertEq(availableBalance, 0, "terminated card has available balance");
            }
            assertTrue(lastCheckpointEpoch <= genesisTimestamp + lifespanSeconds, "checkpoint passed horizon");
        }

        assertTrue(
            availableSum <= handler.totalOpenedAllocation(),
            "INVARIANT_VIOLATION: REGISTRY_AVAILABLE_EXCEEDS_OPENED"
        );
    }

    function invariant_NonceTracksNeverLagOpenedStreams() public view {
        ArcOpenRailsHubV1 hub = handler.hub();
        uint256 opened = handler.totalOpenedAllocation() == 0 ? 0 : handler.paycardCount();
        uint256 nonceTotal = 0;

        for (uint256 channel = 0; channel < 32; channel++) {
            nonceTotal += hub.accountNonceTracks(handler.payer(), channel);
        }

        assertTrue(nonceTotal >= opened, "nonce tracks lag opened stream count");
    }
}
