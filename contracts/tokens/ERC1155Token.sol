// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ERC1155Token is ERC1155, Ownable {
  constructor(address creator) ERC1155("") Ownable(creator) {}

  function mint(
    address to,
    uint256 tokenId,
    uint256 amount,
    bytes memory data
  ) external onlyOwner {
    _mint(to, tokenId, amount, data);
  }

  function mintBatch(
    address to,
    uint256[] calldata tokenIds,
    uint256[] calldata amounts,
    bytes calldata data
  ) external onlyOwner {
    _mintBatch(to, tokenIds, amounts, data);
  }

  function burn(
    address from,
    uint256 tokenId,
    uint256 amount
  ) external onlyOwner {
    _burn(from, tokenId, amount);
  }

  function burnBatch(
    address from,
    uint256[] memory tokenIds,
    uint256[] memory amounts
  ) external onlyOwner {
    _burnBatch(from, tokenIds, amounts);
  }
}
