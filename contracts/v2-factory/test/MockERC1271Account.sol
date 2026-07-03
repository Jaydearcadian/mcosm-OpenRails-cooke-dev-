// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Test-only EIP-1271 wallet: validates a 65-byte ECDSA sig against a fixed owner.
contract MockERC1271Account {
    bytes4 private constant MAGICVALUE = 0x1626ba7e;
    address public owner;

    constructor(address _owner) {
        owner = _owner;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        if (signature.length != 65) return 0xffffffff;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        address recovered = ecrecover(hash, v, r, s);
        if (recovered != address(0) && recovered == owner) {
            return MAGICVALUE;
        }
        return 0xffffffff;
    }
}
