// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {ERC721Token} from "../tokens/ERC721Token.sol";
import {SelfCallable} from "../utils/SelfCallable.sol";

contract ERC721TokenFactoryFacet is SelfCallable {
  event ERC721TokenCreated(address tokenAddress);

  function _registerERC721Token(
    string memory name,
    string memory symbol,
    bytes32 salt
  ) internal returns (address) {
    bytes memory bytecode = abi.encodePacked(
      type(ERC721Token).creationCode,
      abi.encode(name, symbol, address(this))
    );

    address newERC721Token;
    assembly {
      newERC721Token := create2(0, add(bytecode, 32), mload(bytecode), salt)
      if iszero(extcodesize(newERC721Token)) {
        revert(0, 0)
      }
    }

    ERC721Token(newERC721Token).transferOwnership(msg.sender);
    emit ERC721TokenCreated(newERC721Token);
    return newERC721Token;
  }

  function registerERC721Token(
    string memory name,
    string memory symbol,
    bytes32 salt
  ) external onlySelf returns (address) {
    return _registerERC721Token(name, symbol, salt);
  }
}
