// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract Badges is ERC1155, Ownable {
    error BadgeAlreadyClaimed(address player, uint256 levelId);

    event BadgeClaimed(address indexed player, uint256 indexed levelId, uint256 indexed tokenId);
    event BaseURIUpdated(string baseURI);

    mapping(address => mapping(uint256 => bool)) public hasClaimedBadge;

    string private baseMetadataURI;

    constructor(string memory initialBaseURI, address initialOwner) ERC1155("") Ownable(initialOwner) {
        baseMetadataURI = initialBaseURI;
    }

    function claimBadge(uint256 levelId) external {
        if (hasClaimedBadge[msg.sender][levelId]) {
            revert BadgeAlreadyClaimed(msg.sender, levelId);
        }

        uint256 tokenId = tokenIdForLevel(levelId);
        hasClaimedBadge[msg.sender][levelId] = true;
        _mint(msg.sender, tokenId, 1, "");

        emit BadgeClaimed(msg.sender, levelId, tokenId);
    }

    function tokenIdForLevel(uint256 levelId) public pure returns (uint256) {
        return levelId;
    }

    function setBaseURI(string memory nextBaseURI) external onlyOwner {
        baseMetadataURI = nextBaseURI;
        emit BaseURIUpdated(nextBaseURI);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string.concat(baseMetadataURI, Strings.toString(tokenId), ".json");
    }
}
