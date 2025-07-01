// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {LibAccessControl} from "../libraries/access/LibAccessControl.sol";
import {AccessControlStorage} from "../storage/access/AccessControlStorage.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

/**
 * @title AccessControlFacet
 * @dev Provides external interfaces for role-based access control
 */
contract AccessControlFacet {
  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
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
   * @dev Initialize the role-based access control system
   */
  function initializeAccessControl() external onlyOwner {
    LibAccessControl.initialize();
  }

  /**
   * @dev Grant a role
   * @param role Role to grant
   * @param account Account to receive the role
   * @return True if the role was granted, false if the account already had the role
   */
  function grantRole(bytes32 role, address account) external onlyRoleAdmin(role) returns (bool) {
    return LibAccessControl._grantRole(role, account);
  }

  /**
   * @dev Revoke a role
   * @param role Role to revoke
   * @param account Account to revoke the role from
   */
  function revokeRole(bytes32 role, address account) external onlyRoleAdmin(role) {
    LibAccessControl._revokeRole(role, account);
  }

  /**
   * @dev Set the admin role for a role
   * @param role Role to set
   * @param adminRole New admin role
   */
  function setRoleAdmin(bytes32 role, bytes32 adminRole) external onlyOwner {
    LibAccessControl._setRoleAdmin(role, adminRole);
  }

  /**
   * @dev Check if an account has a role
   * @param role Role to check
   * @param account Account to check
   * @return True if the account has the role
   */
  function hasRole(bytes32 role, address account) external view returns (bool) {
    return LibAccessControl.hasRole(role, account);
  }

  /**
   * @dev Get the admin role for a role
   * @param role Role to query
   * @return Admin role
   */
  function getRoleAdmin(bytes32 role) external view returns (bytes32) {
    return LibAccessControl.getRoleAdmin(role);
  }
}