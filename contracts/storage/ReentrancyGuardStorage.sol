// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

/**
 * @title ReentrancyGuardStorage
 */

library ReentrancyGuardStorage {
  uint256 constant NOT_ENTERED = 1;
  uint256 constant ENTERED = 2;

  bytes32 constant APP_STORAGE_REENTRANCY_GUARD = keccak256("App.storage.ReentrancyGuard");
  
  struct ReentrancyState {
    uint256 status;
  }

  function layout() internal pure returns (ReentrancyState storage l) {
    bytes32 position = APP_STORAGE_REENTRANCY_GUARD;
    assembly {
      l.slot := position
    }
  }
}