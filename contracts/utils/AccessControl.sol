// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {LibAccessControl} from "../libraries/access/LibAccessControl.sol";
import {AccessControlStorage} from "../storage/access/AccessControlStorage.sol";

/**
 * @title AccessControl
 * @dev Provides role-based access control modifiers
 */
contract AccessControl {
  /**
   * @dev Modifier: requires the caller to have a specific role
   */
  modifier onlyRole(bytes32 role) {
    LibAccessControl.checkRole(role, msg.sender);
    _;
  }
  
  /**
   * @dev Modifier: requires the caller to be an operator
   */
  modifier onlyOperator() {
    LibAccessControl.checkRole(AccessControlStorage.OPERATOR_ROLE, msg.sender);
    _;
  }
  
  /**
   * @dev Modifier: requires the caller to be an emergency handler
   */
  modifier onlyEmergency() {
    LibAccessControl.checkRole(AccessControlStorage.EMERGENCY_ROLE, msg.sender);
    _;
  }
}