// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

// ERC20TokenFactoryFacet Interface
interface IERC20TokenFactory {
  event ERC20TokenCreated(address tokenAddress);

  function registerERC20Token(
    string memory name,
    string memory symbol,
    uint8 decimals,
    bytes32 salt
  ) external returns (address);
}
