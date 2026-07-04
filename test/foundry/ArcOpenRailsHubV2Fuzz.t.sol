// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../../contracts/v2-factory/ArcOpenRailsHubV2Initializable.sol";
import "../../contracts/v2-factory/ArcOpenRailsFactoryV1.sol";
import "../../contracts/MockUSDC.sol";

interface VmV2 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
}

contract ArcOpenRailsHubV2FuzzTest {
    VmV2 internal constant vm = VmV2(address(uint160(uint256(keccak256("hevm cheat code")))));

    ArcOpenRailsHubV2Initializable public hub;
    MockUSDC public usdc;

    uint256 internal payerPrivateKey = 0xA11CE;
    address internal payer;
    address internal recipient = address(0xDEEB001);
    address internal recovery = address(0xBEEFCAFE);

    bytes32 internal constant ENVELOPE_TYPEHASH = keccak256(
        "SettlementIntent(bytes32 paycardId,bytes32 metadataHash,address recipient,uint256 totalAllocationPool,uint256 flowVelocityPerSecond,uint256 genesisTimestamp,uint256 lifespanSeconds,address residualDeltaRecipient,uint256 nonceChannel,uint256 nonceValue)"
    );

    function _bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        require(min <= max, "bad bounds");
        if (value < min) return min;
        if (value > max) return min + (value % (max - min + 1));
        return value;
    }

    function setUp() public {
        usdc = new MockUSDC();
        ArcOpenRailsHubV2Initializable master = new ArcOpenRailsHubV2Initializable();
        ArcOpenRailsFactoryV1 factory = new ArcOpenRailsFactoryV1(address(master));
        address clone = factory.deployCorporateVault(address(usdc));
        hub = ArcOpenRailsHubV2Initializable(clone);

        payer = vm.addr(payerPrivateKey);
        usdc.mint(payer, 20_000_000 * 1e6);
        vm.prank(payer);
        usdc.approve(address(hub), type(uint256).max);
        vm.warp(1_700_000_000);
    }

    function testFuzz_V2ConservesCapitalOnResidualClose(
        uint256 allocation,
        uint256 velocity,
        uint256 lifespan,
        uint256 elapsed
    ) public {
        allocation = _bound(allocation, 1 * 1e6, 1_000_000 * 1e6);
        velocity = _bound(velocity, 1, 100 * 1e6);
        lifespan = _bound(lifespan, 10, 365 days);
        elapsed = _bound(elapsed, 1, lifespan * 2);

        bytes32 paycardId = keccak256(abi.encode("v2-conservation", allocation, velocity, lifespan, elapsed));
        bytes32 metadataHash = keccak256(abi.encode("metadata", paycardId));
        uint256 genesis = block.timestamp;

        bytes memory signature = _signIntent(paycardId, metadataHash, allocation, velocity, genesis, lifespan);

        hub.openPaycardChannel(
            paycardId, metadataHash, recipient, allocation, velocity,
            genesis, lifespan, recovery, signature, 0, 0, payer
        );
        require(usdc.balanceOf(address(hub)) == allocation, "escrow not locked");

        uint256 recipientBefore = usdc.balanceOf(recipient);
        uint256 recoveryBefore = usdc.balanceOf(recovery);

        vm.warp(genesis + elapsed);
        vm.prank(payer);
        hub.flushResidualDelta(paycardId);

        uint256 recipientDelta = usdc.balanceOf(recipient) - recipientBefore;
        uint256 recoveryDelta = usdc.balanceOf(recovery) - recoveryBefore;
        require(recipientDelta + recoveryDelta == allocation, "INVARIANT_VIOLATION: CAPITAL_LEAKAGE");
        require(usdc.balanceOf(address(hub)) == 0, "INVARIANT_VIOLATION: ESCROW_LEFTOVER");
    }

    function _signIntent(
        bytes32 paycardId,
        bytes32 metadataHash,
        uint256 allocation,
        uint256 velocity,
        uint256 genesis,
        uint256 lifespan
    ) internal returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            ENVELOPE_TYPEHASH, paycardId, metadataHash, recipient,
            allocation, velocity, genesis, lifespan, recovery, uint256(0), uint256(0)
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", hub.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
