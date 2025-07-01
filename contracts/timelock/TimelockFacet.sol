// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {TimelockController} from "./TimelockController.sol";
import {LibAccessControl} from "../libraries/access/LibAccessControl.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {AccessControlStorage} from "../storage/access/AccessControlStorage.sol";

/**
 * @title TimelockFacet
 * @dev External interface for the timelock controller, used to delay the execution of critical operations
 */
contract TimelockFacet {
  // Event definitions
  event Operation(
    bytes32 indexed operationId,
    address indexed target,
    uint256 value,
    bytes data,
    uint8 operationType,  // 1: Scheduled, 2: Executed, 3: Cancelled, 4: DelayChanged
    uint256 timestamp,
    uint256 delay
  );
  
  // Modifier: only admin can call
  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
    _;
  }
  
  // Modifier: only emergency role can call
  modifier onlyEmergency() {
    LibAccessControl.checkRole(AccessControlStorage.EMERGENCY_ROLE, msg.sender);
    _;
  }

  modifier onlyRoleAdmin(bytes32 role) {
    bytes32 adminRole = LibAccessControl.getRoleAdmin(role);
    if (!LibAccessControl.hasRole(adminRole, msg.sender) && msg.sender != LibDiamond.contractOwner()) {
      revert LibAccessControl.AccessControlUnauthorizedAdmin(msg.sender, role, adminRole);
    }
    _;
  }
  
  /**
   * @dev Initialize the timelock controller
   * @param initialDelay Initial delay time (in seconds)
   */
  function initializeTimelock(uint256 initialDelay) external {
    LibDiamond.enforceIsContractOwner();
    TimelockController.initialize(initialDelay);
  }
  
  /**
   * @dev Update the minimum delay time
   * @param newDelay New delay time (in seconds)
   */
  function updateDelay(uint256 newDelay) external onlyRoleAdmin(AccessControlStorage.DEFAULT_ADMIN_ROLE) {
    TimelockController._setMinDelay(newDelay);
  }
  
  /**
   * @dev Schedule an operation
   * @param target Target contract address
   * @param value Amount of ETH to send
   * @param data Call data
   * @param predecessor Hash of the predecessor operation
   * @param delay Delay time (in seconds)
   * @return operationId Operation ID
   */
  function schedule(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 predecessor,
    uint256 delay,
    bytes32 salt
  ) external onlyRoleAdmin(AccessControlStorage.DEFAULT_ADMIN_ROLE) returns (bytes32) {
    bytes32 operationId = TimelockController._schedule(
      target,
      value,
      data,
      predecessor,
      delay,
      salt
    );
    
    return operationId;
  }
  
  /**
   * @dev Execute an operation
   * @param target Target contract address
   * @param value Amount of ETH to send
   * @param data Call data
   * @param predecessor Hash of the predecessor operation
   * @return Call return data
   */
  function execute(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 predecessor,
    bytes32 salt
  ) external payable onlyRoleAdmin(AccessControlStorage.DEFAULT_ADMIN_ROLE) returns (bytes memory) {
    return TimelockController._execute(target, value, data, predecessor, salt);
  }
  
  /**
   * @dev Cancel an operation
   * @param operationId Operation ID
   */
  function cancel(bytes32 operationId) external onlyRoleAdmin(AccessControlStorage.DEFAULT_ADMIN_ROLE) {
    TimelockController._cancel(operationId);
  }
  
  /**
   * @dev Emergency cancel an operation
   * @param operationId Operation ID
   */
  function emergencyCancel(bytes32 operationId) external onlyEmergency {
    TimelockController._cancel(operationId);
  }
  
  /**
   * @dev Get the minimum delay time
   * @return The current minimum delay time in seconds
   */
  function getMinDelay() external view returns (uint256) {
    return TimelockController._getMinDelay();
  }
  
  /**
   * @dev Get operation state
   * @param operationId Operation ID
   * @return Operation state
   */
  function getOperationState(bytes32 operationId) external view returns (uint8) {
    return uint8(TimelockController._getOperationState(operationId));
  }
  
  /**
   * @dev Check if an operation is ready to execute
   * @param operationId Operation ID
   * @return Whether the operation can be executed
   */
  function isOperationReady(bytes32 operationId) external view returns (bool) {
    return TimelockController._isOperationReady(operationId);
  }
  
  /**
   * @dev Check if an operation is done
   * @param operationId Operation ID
   * @return Whether the operation is done
   */
  function isOperationDone(bytes32 operationId) external view returns (bool) {
    return TimelockController._isOperationDone(operationId);
  }
  
  /**
   * @dev Check if an operation is pending
   * @param operationId Operation ID
   * @return Whether the operation is pending
   */
  function isOperationPending(bytes32 operationId) external view returns (bool) {
    return TimelockController._isOperationPending(operationId);
  }
  
  /**
   * @dev Calculate operation ID
   * @param target Target contract address
   * @param value Amount of ETH to send
   * @param data Call data
   * @param predecessor Hash of the predecessor operation
   * @return Operation ID
   */
  function hashOperation(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 predecessor,
    bytes32 salt
  ) external pure returns (bytes32) {
    return TimelockController._hashOperation(target, value, data, predecessor, salt);
  }
}