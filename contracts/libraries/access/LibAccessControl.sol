// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {AccessControlStorage} from "../../storage/access/AccessControlStorage.sol";
import {LibDiamond} from "../LibDiamond.sol";

/**
 * @title LibAccessControl
 * @dev Implementation of role-based access control logic
 */
library LibAccessControl {
  // Event definitions
  event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);
  event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
  event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

  // Custom errors
  error AccessControlUnauthorized(address account, bytes32 role);
  error AccessControlUnauthorizedAdmin(address account, bytes32 role, bytes32 adminRole);
  
  /**
   * @dev Initialize the role-based access control system
   */
  function initialize() internal {
    // Set default admin role
    _setupRole(AccessControlStorage.DEFAULT_ADMIN_ROLE, LibDiamond.contractOwner());
    
    // Set admin roles for each role
    _setRoleAdmin(AccessControlStorage.OPERATOR_ROLE, AccessControlStorage.DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(AccessControlStorage.EMERGENCY_ROLE, AccessControlStorage.DEFAULT_ADMIN_ROLE);
  }
  
  /**
   * @dev Check if an account has a role
   * @param role Role to check
   * @param account Account address to check
   */
  function checkRole(bytes32 role, address account) internal view {
    if (!hasRole(role, account)) {
      revert AccessControlUnauthorized(account, role);
    }
  }
  
  /**
   * @dev Check if an account has a role
   * @param role Role to check
   * @param account Account address to check
   * @return True if the account has the role
   */
  function hasRole(bytes32 role, address account) internal view returns (bool) {
    return _getRoleData(role).members[account];
  }
  
  /**
   * @dev Get the admin role for a role
   * @param role Role to query
   * @return Admin role
   */
  function getRoleAdmin(bytes32 role) internal view returns (bytes32) {
    return _getRoleData(role).adminRole;
  }
  
  /**
   * @dev Grant a role to an account
   * @param role Role to grant
   * @param account Account address to receive the role
   * @return True if the role was granted, false if the account already had the role
   */
  function _grantRole(bytes32 role, address account) internal returns (bool) {
    if (!hasRole(role, account)) {
      _getRoleData(role).members[account] = true;
      emit RoleGranted(role, account, msg.sender);
      return true;
    }
    return false;
  }
  
  /**
   * @dev Revoke a role from an account
   * @param role Role to revoke
   * @param account Account address to revoke the role from
   */
  function _revokeRole(bytes32 role, address account) internal {
    if (hasRole(role, account)) {
      _getRoleData(role).members[account] = false;
      emit RoleRevoked(role, account, msg.sender);
    }
  }
  
  /**
   * @dev Set the admin role for a role
   * @param role Role to set
   * @param adminRole New admin role
   */
  function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal {
    bytes32 previousAdminRole = getRoleAdmin(role);
    _getRoleData(role).adminRole = adminRole;
    emit RoleAdminChanged(role, previousAdminRole, adminRole);
  }

  /**
   * @dev Grant a role to an account (internal)
   * @param role Role to grant
   * @param account Account address to receive the role
   */
  function _setupRole(bytes32 role, address account) internal {
    _grantRole(role, account);
  }
  
  /**
   * @dev Grant a role to an account (internal)
   * @param role Role to grant
   * @param account Account address to receive the role
   */
  function _setupRole(bytes32 role, address account, bytes32 adminRole) internal {
    _grantRole(role, account);
    _setRoleAdmin(role, adminRole);
  }
  
  /**
   * @dev Revoke a role from an account (internal)
   * @param role Role to revoke
   * @param account Account address to revoke the role from
   */
  function _removeRole(bytes32 role, address account) internal {
    if (hasRole(role, account)) {
      _getRoleData(role).members[account] = false;
      emit RoleRevoked(role, account, msg.sender);
    }
  }
  
  /**
   * @dev Get role data
   * @param role Role to query
   * @return Role data
   */
  function _getRoleData(bytes32 role) private view returns (AccessControlStorage.RoleData storage) {
    AccessControlStorage.RoleRegistry storage data;
    bytes32 position = AccessControlStorage.POSITION;
    assembly {
      data.slot := position
    }
    return data.roles[role];
  }
}