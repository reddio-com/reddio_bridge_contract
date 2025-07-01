// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

library LibChildLayerTokenStorage {
  bytes32 constant CHILD_LAYER_TOKEN_STORAGE_POSITION =
    keccak256("child.layer.token.storage");

  struct ChildLayerTokenStorage {
    address l1RdoTokenAddress;
    mapping(address => address) bridgedERC20TokenMap;
    mapping(address => address) erc20TokenMap;
    mapping(address => address) bridgedERC721TokenMap;
    mapping(address => address) erc721TokenMap;
    mapping(address => address) bridgedERC1155TokenMap;
    mapping(address => address) erc1155TokenMap;
  }

  function _tokenStorage()
    internal
    pure
    returns (ChildLayerTokenStorage storage cs)
  {
    bytes32 position = CHILD_LAYER_TOKEN_STORAGE_POSITION;
    assembly {
      cs.slot := position
    }
  }

  // Read functions
  function getL1RedTokenAddress() external view returns (address) {
    return _tokenStorage().l1RdoTokenAddress;
  }

  function getBridgedERC20Token(
    address erc20Address
  ) external view returns (address) {
    return _tokenStorage().bridgedERC20TokenMap[erc20Address];
  }

  function getERC20Token(
    address bridgedERC20Address
  ) external view returns (address) {
    return _tokenStorage().erc20TokenMap[bridgedERC20Address];
  }

  function getBridgedERC721Token(
    address erc721Address
  ) external view returns (address) {
    return _tokenStorage().bridgedERC721TokenMap[erc721Address];
  }

  function getERC721Token(
    address bridgedERC721Address
  ) external view returns (address) {
    return _tokenStorage().erc721TokenMap[bridgedERC721Address];
  }

  function getBridgedERC1155Token(
    address erc1155Address
  ) external view returns (address) {
    return _tokenStorage().bridgedERC1155TokenMap[erc1155Address];
  }

  function getERC1155Token(
    address bridgedERC1155TokenAddress
  ) external view returns (address) {
    return _tokenStorage().erc1155TokenMap[bridgedERC1155TokenAddress];
  }

  // Write functions
  function _setL1RedTokenAddress(address l1RdoTokenAddress) internal {
    _tokenStorage().l1RdoTokenAddress = l1RdoTokenAddress;
  }

  function _setBridgedERC20Token(
    address erc20Address,
    address bridgedERC20Address
  ) internal {
    _tokenStorage().erc20TokenMap[bridgedERC20Address] = erc20Address;
    _tokenStorage().bridgedERC20TokenMap[erc20Address] = bridgedERC20Address;
  }

  function _setBridgedERC721Token(
    address erc721Address,
    address bridgedERC721Address
  ) internal {
    _tokenStorage().erc721TokenMap[bridgedERC721Address] = erc721Address;
    _tokenStorage().bridgedERC721TokenMap[erc721Address] = bridgedERC721Address;
  }

  function _setBridgedERC1155Token(
    address erc1155Address,
    address bridgedERC1155Address
  ) internal {
    _tokenStorage().erc1155TokenMap[bridgedERC1155Address] = erc1155Address;
    _tokenStorage().bridgedERC1155TokenMap[
      erc1155Address
    ] = bridgedERC1155Address;
  }
}
