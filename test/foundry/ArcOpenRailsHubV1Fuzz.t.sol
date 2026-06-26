// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../../contracts/ArcOpenRailsHubV1.sol";
import "../../contracts/MockUSDC.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
    function expectRevert() external;
    function expectRevert(bytes4 revertData) external;
    function assume(bool condition) external;
}

contract FoundryAssertions {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function _bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        require(min <= max, "bad bounds");
        if (value < min) return min;
        if (value > max) return min + (value % (max - min + 1));
        return value;
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        require(actual == expected, message);
    }

    function assertEq(address actual, address expected, string memory message) internal pure {
        require(actual == expected, message);
    }

    function assertTrue(bool condition, string memory message) internal pure {
        require(condition, message);
    }
}

contract ArcOpenRailsHubV1FuzzTest is FoundryAssertions {
    ArcOpenRailsHubV1 public hub;
    MockUSDC public usdc;

    uint256 internal payerPrivateKey;
    address internal payer;
    address internal recipient;
    address internal recovery;

    bytes32 internal constant ENVELOPE_TYPEHASH = keccak256(
        "SettlementIntent(bytes32 paycardId,bytes32 metadataHash,address recipient,uint256 totalAllocationPool,uint256 flowVelocityPerSecond,uint256 genesisTimestamp,uint256 lifespanSeconds,address residualDeltaRecipient,uint256 nonceChannel,uint256 nonceValue)"
    );

    function setUp() public {
        usdc = new MockUSDC();
        hub = new ArcOpenRailsHubV1(address(usdc));

        payerPrivateKey = 0xA11CE;
        payer = vm.addr(payerPrivateKey);
        recipient = address(0xDEEB001);
        recovery = address(0xBEEFCAFE);

        usdc.mint(payer, 20_000_000 * 1e6);
        vm.prank(payer);
        usdc.approve(address(hub), type(uint256).max);
        vm.warp(1_700_000_000);
    }

    function testFuzz_ConservesCapitalOnResidualClose(
        uint256 allocation,
        uint256 velocity,
        uint256 lifespan,
        uint256 elapsed
    ) public {
        allocation = _bound(allocation, 1 * 1e6, 1_000_000 * 1e6);
        velocity = _bound(velocity, 1, 100 * 1e6);
        lifespan = _bound(lifespan, 10, 365 days);
        elapsed = _bound(elapsed, 1, lifespan * 2);

        bytes32 paycardId = keccak256(abi.encode("conservation", allocation, velocity, lifespan, elapsed));
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
            0,
            0
        );

        hub.openPaycardChannel(
            paycardId,
            metadataHash,
            recipient,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            signature,
            0,
            0
        );

        assertEq(usdc.balanceOf(address(hub)), allocation, "escrow not locked");

        uint256 recipientBefore = usdc.balanceOf(recipient);
        uint256 recoveryBefore = usdc.balanceOf(recovery);

        vm.warp(genesis + elapsed);
        vm.prank(payer);
        hub.flushResidualDelta(paycardId);

        uint256 recipientDelta = usdc.balanceOf(recipient) - recipientBefore;
        uint256 recoveryDelta = usdc.balanceOf(recovery) - recoveryBefore;
        assertEq(recipientDelta + recoveryDelta, allocation, "INVARIANT_VIOLATION: CAPITAL_LEAKAGE");
        assertEq(usdc.balanceOf(address(hub)), 0, "INVARIANT_VIOLATION: ESCROW_LEFTOVER");
    }

    function testFuzz_SettlementCheckpointNeverPassesLifespan(
        uint256 allocation,
        uint256 velocity,
        uint256 lifespan,
        uint256 elapsed
    ) public {
        allocation = _bound(allocation, 1 * 1e6, 1_000_000 * 1e6);
        velocity = _bound(velocity, 1, 100 * 1e6);
        lifespan = _bound(lifespan, 10, 365 days);
        elapsed = _bound(elapsed, 1, lifespan * 3);

        bytes32 paycardId = keccak256(abi.encode("horizon", allocation, velocity, lifespan, elapsed));
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
            0,
            0
        );

        hub.openPaycardChannel(
            paycardId,
            metadataHash,
            recipient,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            signature,
            0,
            0
        );

        vm.warp(genesis + elapsed);
        hub.processDripSettle(paycardId);

        (, , , , , , , , uint256 lastCheckpointEpoch, , ) = hub.registry(paycardId);
        assertTrue(lastCheckpointEpoch <= genesis + lifespan, "INVARIANT_VIOLATION: HORIZON_BREACH");
        assertTrue(usdc.balanceOf(recipient) <= allocation, "INVARIANT_VIOLATION: CEILING_BREACH");
    }

    function testFuzz_NonceLanesAreSequentialAndIndependent(uint256 channel) public {
        channel = _bound(channel, 0, 1_000_000);
        uint256 allocation = 100 * 1e6;
        uint256 velocity = 1 * 1e6;
        uint256 genesis = block.timestamp;
        uint256 lifespan = 100;

        bytes32 first = keccak256(abi.encode("nonce-first", channel));
        bytes32 second = keccak256(abi.encode("nonce-second", channel));
        bytes32 third = keccak256(abi.encode("nonce-third", channel));

        _openFixed(first, allocation, velocity, genesis, lifespan, channel, 0);
        assertEq(hub.accountNonceTracks(payer, channel), 1, "nonce did not increment");

        bytes memory staleSignature = _signatureForDefault(second, allocation, velocity, genesis, lifespan, channel, 0);
        vm.expectRevert();
        hub.openPaycardChannel(
            second,
            keccak256(abi.encode("metadata", second)),
            recipient,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            staleSignature,
            channel,
            0
        );

        _openFixed(second, allocation, velocity, genesis, lifespan, channel, 1);
        assertEq(hub.accountNonceTracks(payer, channel), 2, "second nonce did not increment");

        _openFixed(third, allocation, velocity, genesis, lifespan, channel + 1, 0);
        assertEq(hub.accountNonceTracks(payer, channel + 1), 1, "independent lane did not start at zero");
    }

    function testFuzz_TamperedSignedFieldsFail(bytes32 salt, uint256 allocation) public {
        allocation = _bound(allocation, 1 * 1e6, 1_000_000 * 1e6);
        bytes32 paycardId = keccak256(abi.encode("tamper", salt));
        bytes32 metadataHash = keccak256(abi.encode("metadata", paycardId));
        uint256 velocity = 1 * 1e6;
        uint256 genesis = block.timestamp;
        uint256 lifespan = 100;

        bytes memory signature = _signIntent(
            paycardId,
            metadataHash,
            recipient,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            0,
            0
        );

        vm.expectRevert();
        hub.openPaycardChannel(
            paycardId,
            keccak256(abi.encode("tampered", metadataHash)),
            recipient,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            signature,
            0,
            0
        );

        (address openedPayer, , , , , , , , , , ) = hub.registry(paycardId);
        assertEq(openedPayer, address(0), "tampered intent opened");
    }

    function testFuzz_WildcardRailsCardBindsFirstClaimant(bytes32 salt) public {
        bytes32 paycardId = keccak256(abi.encode("wildcard", salt));
        bytes32 metadataHash = keccak256(abi.encode("metadata", paycardId));
        uint256 allocation = 50 * 1e6;
        uint256 velocity = 1 * 1e6;
        uint256 genesis = block.timestamp;
        uint256 lifespan = 100;
        address firstClaimant = address(0xCA11);
        address secondClaimant = address(0xCA12);

        bytes memory signature = _signIntent(
            paycardId,
            metadataHash,
            address(0),
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            0,
            0
        );

        hub.claimWildcardPaycardChannel(
            paycardId,
            metadataHash,
            firstClaimant,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            signature,
            0,
            0
        );

        (, address boundRecipient, , , , , , , , , ) = hub.registry(paycardId);
        assertEq(boundRecipient, firstClaimant, "first claimant not bound");
        vm.expectRevert(ArcOpenRailsHubV1.CryptographicCollision.selector);
        hub.claimWildcardPaycardChannel(
            paycardId,
            metadataHash,
            secondClaimant,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            signature,
            0,
            0
        );
    }

    function testFuzz_OnlyPayerOrRecipientCanFlush(address caller) public {
        vm.assume(caller != payer && caller != recipient);
        bytes32 paycardId = keccak256(abi.encode("flush-auth", caller));
        _openFixed(paycardId, 100 * 1e6, 1 * 1e6, block.timestamp, 100, 0, 0);

        vm.prank(caller);
        vm.expectRevert(ArcOpenRailsHubV1.AccessViolation.selector);
        hub.flushResidualDelta(paycardId);
    }

    function _openFixed(
        bytes32 paycardId,
        uint256 allocation,
        uint256 velocity,
        uint256 genesis,
        uint256 lifespan,
        uint256 channel,
        uint256 nonceValue
    ) internal {
        bytes32 metadataHash = keccak256(abi.encode("metadata", paycardId));
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
        hub.openPaycardChannel(
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
        );
    }

    function _signatureForDefault(
        bytes32 paycardId,
        uint256 allocation,
        uint256 velocity,
        uint256 genesis,
        uint256 lifespan,
        uint256 channel,
        uint256 nonceValue
    ) internal returns (bytes memory) {
        return _signIntent(
            paycardId,
            keccak256(abi.encode("metadata", paycardId)),
            recipient,
            allocation,
            velocity,
            genesis,
            lifespan,
            recovery,
            channel,
            nonceValue
        );
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
