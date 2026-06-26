// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title OpenRails V2 Workflow NFT Prototype
 * @notice Tokenizes administrative control and payout rights of active Paycard Streams.
 */
contract WorkflowNFT {
    string public name = "OpenRails Workflow NFT";
    string public symbol = "OR-WF-NFT";

    // ERC721 Storage mappings
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // OpenRails V2 mappings
    mapping(uint256 => address) public payoutRedirections;
    mapping(uint256 => bool) public isHalted;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    event PayoutRedirected(uint256 indexed tokenId, address indexed oldRecipient, address indexed newRecipient);
    event StreamHalted(uint256 indexed tokenId);
    event StreamResumed(uint256 indexed tokenId);

    modifier onlyTokenOwner(uint256 tokenId) {
        require(_owners[tokenId] == msg.sender, "WorkflowNFT: caller is not the owner");
        _;
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "ERC721: address zero is not a valid owner");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: invalid token ID");
        return owner;
    }

    function mint(address to, uint256 tokenId) external {
        require(to != address(0), "ERC721: mint to the zero address");
        require(_owners[tokenId] == address(0), "ERC721: token already minted");

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    /**
     * @notice Redirects the destination address for a paycard's streaming payout.
     */
    function redirectPayout(uint256 tokenId, address newRecipient) external onlyTokenOwner(tokenId) {
        require(newRecipient != address(0), "WorkflowNFT: invalid recipient");
        address oldRecipient = payoutRedirections[tokenId];
        payoutRedirections[tokenId] = newRecipient;

        emit PayoutRedirected(tokenId, oldRecipient, newRecipient);
    }

    /**
     * @notice Emergency halt of the stream associated with this NFT.
     */
    function haltStream(uint256 tokenId) external onlyTokenOwner(tokenId) {
        require(!isHalted[tokenId], "WorkflowNFT: stream already halted");
        isHalted[tokenId] = true;
        emit StreamHalted(tokenId);
    }

    /**
     * @notice Resume a halted stream.
     */
    function resumeStream(uint256 tokenId) external onlyTokenOwner(tokenId) {
        require(isHalted[tokenId], "WorkflowNFT: stream is active");
        isHalted[tokenId] = false;
        emit StreamResumed(tokenId);
    }

    // --- Simple Transfer Logic ---
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");

        // Clear approvals
        delete _tokenApprovals[tokenId];

        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }
}
