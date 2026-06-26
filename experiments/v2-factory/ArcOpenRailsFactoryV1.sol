// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract ArcOpenRailsFactoryV1 {
    address public immutable masterLogicHub;
    address[] public deployedVaults;
    mapping(address => bool) public isDeployedVault;

    event CorporateVaultDeployed(address indexed vaultAddress, address indexed owner, address token);

    constructor(address _masterLogicHub) {
        require(_masterLogicHub != address(0), "Invalid master logic hub");
        masterLogicHub = _masterLogicHub;
    }

    /**
     * @notice Deploys a sovereign, gas-optimized ERC-1167 clone of the master OpenRails logic.
     * @param _token - The ERC20 clearing token designated for this corporate vault (e.g. USDC).
     * @return cloneAddress The address of the newly deployed isolated proxy contract.
     */
    function deployCorporateVault(address _token) external returns (address cloneAddress) {
        // Clone the master logic contract using ERC-1167 assembly bytecode
        cloneAddress = _clone(masterLogicHub);

        // Pass initialization to the proxy context (e.g., set owner, pause state, and token address)
        (bool success, ) = cloneAddress.call(
            abi.encodeWithSignature("initialize(address,address)", _token, msg.sender)
        );
        require(success, "Initialization failed");

        deployedVaults.push(cloneAddress);
        isDeployedVault[cloneAddress] = true;

        emit CorporateVaultDeployed(cloneAddress, msg.sender, _token);
    }

    /**
     * @dev Deploys a clone using ERC-1167 minimal proxy pattern in assembly.
     */
    function _clone(address implementation) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(96, implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "ERC1167: clone failed");
    }
}
