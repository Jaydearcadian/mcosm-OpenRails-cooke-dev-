# OpenRails V1: Contract Standards & Dependency Analysis

This document provides a technical audit of the contract standards, libraries, and external dependencies used in OpenRails V1, and maps out the implementation strategy for the Workflow NFT and Proxy Factory modules.

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. Discovery: Existing Standards & Library Usage

An audit of the repository reveals that **OpenRails V1 is a zero-dependency contract architecture**. It avoids external packages (like OpenZeppelin or Solmate) to keep compilation lightweight, fast, and dependency-free:

1. **Custom Reentrancy Guards:** [ArcOpenRailsHubV1.sol](../contracts/ArcOpenRailsHubV1.sol#L18) implements its own lock-state variable `_status` (`_NOT_ENTERED = 1`, `_ENTERED = 2`) rather than importing OpenZeppelin's `ReentrancyGuard`.
2. **Custom Ownable2Step:** [ArcOpenRailsHubV1.sol](../contracts/ArcOpenRailsHubV1.sol#L32) implements its own ownership transfer logic.
3. **Custom Pausable:** [ArcOpenRailsHubV1.sol](../contracts/ArcOpenRailsHubV1.sol#L60) implements pausable circuit-breaker modifiers natively.
4. **Mock USDC:** [MockUSDC.sol](../contracts/MockUSDC.sol) defines basic ERC-20 fields (`balanceOf`, `allowance`, `decimals`) and standard event signatures manually without external ERC20 base classes.
5. **No OpenZeppelin Packages:** There are no OpenZeppelin dependencies declared in `package.json`, `foundry.toml`, or local `node_modules` folders.

---

## 2. Integration Mapping: The Two Paths

Since our proposed specs (Workflow NFT and Proxy Factory) reference standard contracts (`ERC721` and `Clones`), we have two implementation options:

### Path A: Zero-Dependency / Inline Implementations (Recommended)
This path aligns with the repository's existing design philosophy by writing clean, minimal implementations directly in our extension contracts.

#### 1. Zero-Dependency ERC-1167 Clones (`ArcOpenRailsFactoryV1.sol`)
Rather than importing `Clones.sol`, we deploy clones using inline assembly. The deployment bytecode for an ERC-1167 proxy is constant:

```solidity
contract ArcOpenRailsFactoryV1 {
    address public immutable masterLogicHub;

    constructor(address _masterLogicHub) {
        masterLogicHub = _masterLogicHub;
    }

    /**
     * @notice Deploys a sovereign, gas-optimized ERC-1167 clone using inline assembly
     */
    function clone(address target) internal returns (address result) {
        bytes20 targetBytes = bytes20(target);
        assembly {
            // Allocate memory for deployment
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            result := create(0, clone, 0x37)
        }
    }
}
```

#### 2. Lightweight Custom ERC-721 (`OpenRailsWorkflowNFT.sol`)
Instead of importing the full OpenZeppelin ERC-721 library (which adds significant gas overhead and compilation weight), we write a minimal ERC-721 matching the standard interface needed for workflow tracking:

```solidity
contract OpenRailsWorkflowNFT {
    string public constant name = "OpenRails Workflow Positions";
    string public constant symbol = "OR-WORK";

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }

    // Implement standard balance checks, approvals, and transferFrom logic inline...
}
```

### Path B: OpenZeppelin Package Installation
If standard compliant logic is strictly preferred:
1. Update `package.json` dependencies:
   ```bash
   npm install @openzeppelin/contracts
   ```
2. Configure import paths inside `foundry.toml` under a remappings array:
   ```toml
   remappings = [
       "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/"
   ]
   ```

---

## 3. EVM Version & Compiler Context

The contracts are built for **Solidity v0.8.26** targeting the **Paris** EVM hardfork (`evm_version = "paris"` configured in `foundry.toml`).
* Since the Paris hardfork does not support EVM opcodes introduced in Shanghai/Cancun (like `PUSH0` or transient storage `TSTORE`/`TLOAD`), all inline assembly code and library usage must remain strictly compatible with the Paris hardfork spec to avoid runtime contract deployment reverts on target L1 chains.
