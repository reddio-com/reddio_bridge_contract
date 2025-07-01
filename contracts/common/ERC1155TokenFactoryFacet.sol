// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {ERC1155Token} from "../tokens/ERC1155Token.sol";
import {SelfCallable} from "../utils/SelfCallable.sol";

contract ERC1155TokenFactoryFacet is SelfCallable {
  event ERC1155TokenCreated(address tokenAddress);

  function _registerERC1155Token(bytes32 salt) internal returns (address) {
    bytes memory bytecode = abi.encodePacked(
      type(ERC1155Token).creationCode,
      abi.encode(address(this))
    );

    address newERC1155Token;
    assembly {
      newERC1155Token := create2(0, add(bytecode, 32), mload(bytecode), salt)
      if iszero(extcodesize(newERC1155Token)) {
        revert(0, 0)
      }
    }

    ERC1155Token(newERC1155Token).transferOwnership(msg.sender);
    emit ERC1155TokenCreated(newERC1155Token);
    return newERC1155Token;
  }

  function registerERC1155Token(
    bytes32 salt
  ) external onlySelf returns (address) {
    return _registerERC1155Token(salt);
  }
}
