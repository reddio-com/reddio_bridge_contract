// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {ERC20Token} from "../tokens/ERC20Token.sol";
import {SelfCallable} from "../utils/SelfCallable.sol";

contract ERC20TokenFactoryFacet is SelfCallable {
  event ERC20TokenCreated(address tokenAddress);

  function _registerERC20Token(
    string memory name,
    string memory symbol,
    uint8 decimals,
    bytes32 salt
  ) internal returns (address) {
    bytes memory bytecode = abi.encodePacked(
      type(ERC20Token).creationCode,
      abi.encode(name, symbol, decimals, address(this))
    );

    address newERC20Token;
    assembly {
      newERC20Token := create2(0, add(bytecode, 32), mload(bytecode), salt)
      if iszero(extcodesize(newERC20Token)) {
        revert(0, 0)
      }
    }

    emit ERC20TokenCreated(newERC20Token);
    return newERC20Token;
  }

  function registerERC20Token(
    string memory name,
    string memory symbol,
    uint8 decimals,
    bytes32 salt
  ) external onlySelf returns (address) {
    return _registerERC20Token(name, symbol, decimals, salt);
  }
}
