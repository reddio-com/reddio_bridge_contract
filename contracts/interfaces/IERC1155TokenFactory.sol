// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

// ERC1155TokenFactoryFacet Interface
interface IERC1155TokenFactory {
  event ERC1155TokenCreated(address tokenAddress);

  function registerERC1155Token(bytes32 salt) external returns (address);
}
