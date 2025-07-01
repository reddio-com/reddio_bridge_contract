// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

/**
 * @title TimelockController
 * @dev Timelock controller for delaying critical operations
 */
library TimelockController {
  // Storage position
  bytes32 constant TIMELOCK_STORAGE_POSITION = keccak256("app.timelock.controller.storage");
  
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
  struct TimelockStorage {
    uint256 minDelay;     // Minimum delay time in seconds
    mapping(bytes32 => Operation) operations; // Operation mapping
  }
  
  // Events
  event TimelockOperationScheduled(
    bytes32 indexed operationId,
    address indexed target,
    uint256 value,
    bytes data,
    bytes32 predecessor,
    uint256 timestamp,
    uint256 delay,
    bytes32 salt
  );

  event TimelockOperationExecuted(
    bytes32 indexed operationId,
    address indexed target,
    uint256 value,
    bytes data,
    bytes32 predecessor,
    bytes32 salt
  );

  event OperationCancelled(
    bytes32 indexed operationId
  );

  event MinDelayChanged(
    uint256 oldDelay,
    uint256 newDelay
  );
  
  // Errors
  error TimelockInvalidDelay(uint256 delay);
  error TimelockOperationNotFound(bytes32 operationId);
  error TimelockOperationNotReady(bytes32 operationId);
  error TimelockOperationAlreadyScheduled(bytes32 operationId);
  
  /**
   * @dev Get timelock storage
   */
  function _timelockStorage() internal pure returns (TimelockStorage storage ts) {
    bytes32 position = TIMELOCK_STORAGE_POSITION;
    assembly {
      ts.slot := position
    }
  }
  
  /**
   * @dev Initialize timelock controller
   * @param initialDelay Initial delay time in seconds
   */
  function initialize(uint256 initialDelay) internal {
    _timelockStorage().minDelay = initialDelay;
  }
  
  /**
   * @dev Set minimum delay time
   * @param newDelay New delay time in seconds
   */
  function _setMinDelay(uint256 newDelay) internal {
    uint256 oldDelay = _timelockStorage().minDelay;
    _timelockStorage().minDelay = newDelay;
    emit MinDelayChanged(oldDelay, newDelay);
  }
  
  /**
   * @dev Calculate operation ID
   */
  function _hashOperation(
    address target,
    uint256 value,
    bytes memory data,
    bytes32 predecessor,
    bytes32 salt
  ) internal pure returns (bytes32) {
    return keccak256(abi.encode(target, value, data, predecessor, salt));
  }
  
  /**
   * @dev Get operation status
   */
  function _getOperationState(bytes32 operationId) internal view returns (OperationState) {
    return _timelockStorage().operations[operationId].status;
  }
  
  /**
   * @dev Check if operation can be executed
   */
  function _isOperationReady(bytes32 operationId) internal view returns (bool) {
    Operation storage operation = _timelockStorage().operations[operationId];
    return operation.status == OperationState.Pending &&
           block.timestamp >= operation.timestamp + operation.delay;
  }
  
  /**
   * @dev Check if operation is done
   */
  function _isOperationDone(bytes32 operationId) internal view returns (bool) {
    return _getOperationState(operationId) == OperationState.Done;
  }
  
  /**
   * @dev Check if operation is pending
   */
  function _isOperationPending(bytes32 operationId) internal view returns (bool) {
    return _getOperationState(operationId) == OperationState.Pending;
  }

  /**
   * @dev Get minimum delay time
   * @return The current minimum delay time in seconds
   */
  function _getMinDelay() internal view returns (uint256) {
    return _timelockStorage().minDelay;
  }
  
  /**
   * @dev Schedule operation
   */
  function _schedule(
    address target,
    uint256 value,
    bytes memory data,
    bytes32 predecessor,
    uint256 delay,
    bytes32 salt
  ) internal returns (bytes32) {
    // Check delay time
    if (delay < _timelockStorage().minDelay) {
      revert TimelockInvalidDelay(delay);
    }
    
    // Calculate operation ID
    bytes32 operationId = _hashOperation(target, value, data, predecessor, salt);
    
    // Check operation status
    if (_getOperationState(operationId) != OperationState.Unset) {
      revert TimelockOperationAlreadyScheduled(operationId);
    }
    
    // Store operation
    Operation storage operation = _timelockStorage().operations[operationId];
    operation.target = target;
    operation.value = value;
    operation.data = data;
    operation.predecessor = predecessor;
    operation.delay = delay;
    operation.timestamp = block.timestamp;
    operation.status = OperationState.Pending;
    
    emit TimelockOperationScheduled(
      operationId,
      target,
      value,
      data,
      predecessor,
      block.timestamp,
      delay,
      salt
    );
    
    return operationId;
  }
  
  /**
   * @dev Execute operation
   */
  function _execute(
    address target,
    uint256 value,
    bytes memory data,
    bytes32 predecessor,
    bytes32 salt
  ) internal returns (bytes memory) {
    bytes32 operationId = _hashOperation(target, value, data, predecessor, salt);
    
    // Check operation status
    Operation storage operation = _timelockStorage().operations[operationId];
    if (operation.status == OperationState.Unset) {
      revert TimelockOperationNotFound(operationId);
    }
    
    // Check if ready to execute
    if (!_isOperationReady(operationId)) {
      revert TimelockOperationNotReady(operationId);
    }
    
    // Update status to executed
    operation.status = OperationState.Done;
    
    // Execute call
    emit TimelockOperationExecuted(operationId, target, value, data, predecessor, salt);
    (bool success, bytes memory returndata) = target.call{value: value}(data);
    if (!success) {
      if (returndata.length > 0) {
        assembly ("memory-safe") {
          let returndata_size := mload(returndata)
          revert(add(32, returndata), returndata_size)
        }
      } else {
        revert("Timelock: call reverted without message");
      }
    }
    return returndata;
  }
  
  /**
   * @dev Cancel operation
   */
  function _cancel(
    bytes32 operationId
  ) internal returns (bytes32) {
    // Check operation status
    Operation storage operation = _timelockStorage().operations[operationId];
    if (operation.status != OperationState.Pending) {
      revert("TimelockController: operation cannot be cancelled");
    }
    
    // Update status to cancelled
    operation.status = OperationState.Cancelled;
    emit OperationCancelled(operationId);
    return operationId;
  }
}