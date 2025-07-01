// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

/**
 * @title TimelockStorage
 * @dev Storage structure for the timelock controller
 */
library TimelockStorage {
  bytes32 constant POSITION = keccak256("app.timelock.controller.storage");
  
  // Operation states
  enum OperationState {
    Unset,    // Not set
    Pending,  // Waiting for execution
    Ready,    // Ready to execute
    Done,     // Executed
    Cancelled // Cancelled
  }
  
  // Operation information
  struct Operation {
    address target;       // Target contract address
    uint256 value;        // Amount of ETH to send
    bytes data;           // Call data
    bytes32 predecessor;  // Hash of the predecessor operation
    uint256 delay;        // Delay time in seconds
    uint256 timestamp;    // Creation timestamp
    OperationState status; // Operation status
  }
  
  // Storage structure
  struct TimelockData {
    uint256 minDelay;     // Minimum delay time in seconds
    mapping(bytes32 => Operation) operations; // Operation mapping
  }
  
  /**
   * @dev Get timelock storage
   */
  function layout() internal pure returns (TimelockData storage ts) {
    bytes32 position = POSITION;
    assembly {
      ts.slot := position
    }
  }
}