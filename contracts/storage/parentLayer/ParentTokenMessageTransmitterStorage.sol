// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

/**
 * @title AccessControlStorage
 * @dev Storage structure for the role-based access control system
 */
library ParentTokenMessageTransmitterStorage {
  bytes32 constant PARENT_TOKEN_MESSAGE_TRANSMITTER_STORAGE_POSITION = keccak256("parent.token.message.transmitter.storage");
  address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  struct Layout {
      mapping(address => bool) enabledTokens;
  }
        
    function layout() internal pure returns (Layout storage l) {
        bytes32 position = PARENT_TOKEN_MESSAGE_TRANSMITTER_STORAGE_POSITION;
        assembly {
            l.slot := position
        }
    }


}