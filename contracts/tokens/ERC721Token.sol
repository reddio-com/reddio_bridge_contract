// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721Token is ERC721, Ownable {
  //uint256 private _tokenIdCounter;

  constructor(
    string memory name,
    string memory symbol,
    address creator
  ) ERC721(name, symbol) Ownable(creator) {
    //_tokenIdCounter = 1;
  }

  function mint(address to, uint256 tokenId) external onlyOwner {
    _mint(to, tokenId);
    //_tokenIdCounter += 1;
  }

  function burn(address tokenOwner, uint256 tokenId) external onlyOwner {
    require(
      ownerOf(tokenId) == tokenOwner,
      "ERC721Token: burn of token that is not own"
    );
    _burn(tokenId);
  }
}
