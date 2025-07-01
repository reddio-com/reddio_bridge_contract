// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IERC1155Token is IERC1155 {
  function mint(
    address to,
    uint256 tokenId,
    uint256 amount,
    bytes memory data
  ) external;

  function mintBatch(
    address to,
    uint256[] calldata tokenIds,
    uint256[] calldata amounts,
    bytes calldata data
  ) external;

  function burn(address from, uint256 tokenId, uint256 amount) external;

  function burnBatch(
    address from,
    uint256[] memory tokenIds,
    uint256[] memory amounts
  ) external;
}
