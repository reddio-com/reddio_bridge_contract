// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

// ERC721TokenFactoryFacet Interface
interface IERC721TokenFactory {
  event ERC721TokenCreated(address tokenAddress);

  function registerERC721Token(
    string memory name,
    string memory symbol,
    bytes32 salt
  ) external returns (address);
}
