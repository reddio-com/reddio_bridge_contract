// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

/**
 * @title AccessControlStorage
 * @dev Storage structure for the role-based access control system
 */
library AccessControlStorage {
  bytes32 constant POSITION = keccak256("app.access.control.storage");
  
  // Predefined roles
  bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;
  bytes32 constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
  bytes32 constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
  
  struct RoleData {
    mapping(address => bool) members;
    bytes32 adminRole;
  }
  
  struct RoleRegistry {
    mapping(bytes32 => RoleData) roles;
  }
  
  function layout() internal pure returns (RoleRegistry storage l) {
    bytes32 position = POSITION;
    assembly {
      l.slot := position
    }
  }
}