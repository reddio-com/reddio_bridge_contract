// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

library LibParentLayerTokenStorage {
  bytes32 constant PARENT_LAYER_TOKEN_STORAGE_POSITION =
    keccak256("parent.layer.token.storage");

  struct ParentLayerTokenStorage {
    address l1RdoTokenAddress;
  }

  function _tokenStorage()
    internal
    pure
    returns (ParentLayerTokenStorage storage cs)
  {
    bytes32 position = PARENT_LAYER_TOKEN_STORAGE_POSITION;
    assembly {
      cs.slot := position
    }
  }

  // Read functions
  function getL1RedTokenAddress() external view returns (address) {
    return _tokenStorage().l1RdoTokenAddress;
  }

  // Write functions
  function _setL1RedTokenAddress(address l1RdoTokenAddress) internal {
    _tokenStorage().l1RdoTokenAddress = l1RdoTokenAddress;
  }
}
