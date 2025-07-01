// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IERC721Token is IERC721 {
  function name() external view returns (string memory);

  function symbol() external view returns (string memory);

  function getApproved(uint256 tokenId) external view returns (address);

  function mint(address to, uint256 tokenId) external;

  function burn(address tokenOwner, uint256 tokenId) external;
}
