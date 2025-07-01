// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

// TokenFactoryFacet Interface
interface ITokenFactory {
  event ERC20TokenCreated(address tokenAddress);
  event ERC721TokenCreated(address tokenAddress);
  event ERC1155TokenCreated(address tokenAddress);

  function registerERC20Token(
    string memory name,
    string memory symbol,
    uint8 decimals,
    bytes32 salt
  ) external returns (address);

  function registerERC721Token(
    string memory name,
    string memory symbol
  ) external returns (address);

  function registerERC1155Token() external returns (address);
}
