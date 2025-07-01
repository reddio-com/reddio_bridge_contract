// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import "hardhat/console.sol";

import {LibChildLayerTokenStorage as LibToken} from "./tokenMessages/LibChildLayerTokenStorage.sol";
import {LibPausable} from "../utils/Pausable.sol";
import {Pausable} from "../utils/Pausable.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {OwnershipFacet} from "../common/OwnershipFacet.sol";

contract ChildBridgeCoreFacet is Pausable {
  bytes32 constant CHILD_LAYER_BRIDGE_CORE_STORAGE_POSITION =
    keccak256("child.bridge.core.storage");

  uint256 private constant MAX_TREE_HEIGHT = 40;

  struct ChildBridgeCoreStorage {
    uint256 nextMessageIndex;
    mapping(bytes32 => uint256) messageSendTimestamp;
    bytes32[MAX_TREE_HEIGHT] zeroHashes;
    bytes32[MAX_TREE_HEIGHT] branches;
    bytes32 messageRoot;
    bool isInitialized;
  }

  event UpwardMessage(uint32 payloadType, bytes payload);

  /// @notice Emitted when a new message is added to the merkle tree.
  /// @param index The index of the corresponding message.
  /// @param messageHash The hash of the corresponding message.
  event AppendMessageEvent(uint256 index, bytes32 messageHash);

  event SentMessage(
    bytes32 indexed xDomainCalldataHash,
    uint256 nonce,
    uint32 payloadType,
    bytes payload,
    uint256 gasLimit
  );
  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
    _;
  }

  modifier onlySelf() {
    require(
      msg.sender == address(this),
      "ChildBridgeCoreFacet: Only self allowed"
    );
    _;
  }

  function initialize() external onlyOwner {
    ChildBridgeCoreStorage storage ds = _bridgeCoreStorage();
    require(!ds.isInitialized, "Already initialized");

    _initializeMerkleTree();
    ds.isInitialized = true;
  }

  function _bridgeCoreStorage()
    internal
    pure
    returns (ChildBridgeCoreStorage storage bs)
  {
    bytes32 position = CHILD_LAYER_BRIDGE_CORE_STORAGE_POSITION;
    assembly {
      bs.slot := position
    }
  }

  function _initializeMerkleTree() internal {
    ChildBridgeCoreStorage storage ds = _bridgeCoreStorage();
    // Compute hashes in empty sparse Merkle tree
    for (uint256 height = 0; height + 1 < MAX_TREE_HEIGHT; height++) {
      ds.zeroHashes[height + 1] = _efficientHash(
        ds.zeroHashes[height],
        ds.zeroHashes[height]
      );
    }
  }

  function _efficientHash(
    bytes32 a,
    bytes32 b
  ) private pure returns (bytes32 value) {
    assembly {
      mstore(0x00, a)
      mstore(0x20, b)
      value := keccak256(0x00, 0x40)
    }
  }

  function _appendMessageHash(
    bytes32 _messageHash
  ) internal returns (uint256, bytes32) {
    ChildBridgeCoreStorage storage ds = _bridgeCoreStorage();
    require(ds.zeroHashes[1] != bytes32(0), "call before initialization");

    uint256 _currentMessageIndex = ds.nextMessageIndex;
    bytes32 _hash = _messageHash;
    uint256 _height = 0;

    while (_currentMessageIndex != 0) {
      if (_currentMessageIndex % 2 == 0) {
        // it may be used in next round.
        ds.branches[_height] = _hash;
        // it's a left child, the right child must be null
        _hash = _efficientHash(_hash, ds.zeroHashes[_height]);
      } else {
        // it's a right child, use previously computed hash
        _hash = _efficientHash(ds.branches[_height], _hash);
      }
      unchecked {
        _height += 1;
      }
      _currentMessageIndex >>= 1;
    }

    ds.branches[_height] = _hash;
    ds.messageRoot = _hash;

    _currentMessageIndex = ds.nextMessageIndex;
    unchecked {
      ds.nextMessageIndex = _currentMessageIndex + 1;
    }

    return (_currentMessageIndex, _hash);
  }

  function appendMessageHash(bytes32 _messageHash) internal returns (uint256) {
    ChildBridgeCoreStorage storage ds = _bridgeCoreStorage();

    uint256 _currentMessageIndex = ds.nextMessageIndex;

    unchecked {
      ds.nextMessageIndex = _currentMessageIndex + 1;
    }

    return _currentMessageIndex;
  }

  function pauseStatusBridge() external view returns (bool) {
    return LibPausable.pauseStatus();
  }

  function unpauseBridge() external onlyOwner returns (bool) {
    LibPausable.unpause();
  }

  function pauseBridge() external onlyOwner returns (bool) {
    LibPausable.pause();
  }

  function appendMessage(bytes32 _messageHash) internal {
    //require(msg.sender == messenger, "only messenger");

    (uint256 _currentNonce, bytes32 _currentRoot) = _appendMessageHash(
      _messageHash
    );

    // We can use the event to compute the merkle tree locally.
    emit AppendMessageEvent(_currentNonce, _messageHash);
  }

  function _appendMessage(bytes32 _messageHash) internal {
    //require(msg.sender == messenger, "only messenger");

    uint256 _currentNonce = appendMessageHash(_messageHash);

    // We can use the event to compute the merkle tree locally.
    emit AppendMessageEvent(_currentNonce, _messageHash);
  }

  /// @dev Internal function to generate the correct cross domain calldata for a message.
  /// @return ABI encoded cross domain calldata.
  function _encodeXDomainCalldata(
    uint32 payloadType,
    bytes calldata payload,
    uint256 messageNonce
  ) internal pure returns (bytes memory) {
    return abi.encode(payloadType, payload, messageNonce);
  }

  /// @dev Internal function to send cross domain message.
  function _sendMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 gasLimit // nonReentrant
  ) internal {
    //require(msg.value == _value, "msg.value mismatch");
    ChildBridgeCoreStorage storage ds = _bridgeCoreStorage();

    uint256 nonce = ds.nextMessageIndex;
    bytes32 xDomainCalldataHash = keccak256(
      _encodeXDomainCalldata(payloadType, payload, nonce)
    );

    // normally this won't happen, since each message has different nonce, but just in case.
    require(
      ds.messageSendTimestamp[xDomainCalldataHash] == 0,
      "Duplicated message"
    );
    ds.messageSendTimestamp[xDomainCalldataHash] = block.timestamp;

    _appendMessage(xDomainCalldataHash);

    emit SentMessage(
      xDomainCalldataHash,
      nonce,
      payloadType,
      payload,
      gasLimit
    );
  }

  function sendUpwardMessage(
    uint32 payloadType,
    bytes calldata payload
  ) external onlySelf whenNotPaused {
    //ChildBridgeCoreStorage storage bs = _bridgeCoreStorage();

    uint256 gasLimit = 0;
    _sendMessage(payloadType, payload, gasLimit);

    emit UpwardMessage(payloadType, payload);
  }

  function setRedTokenAddress(address l1RdoTokenAddress) external {
    LibDiamond.enforceIsContractOwner();
    require(l1RdoTokenAddress != address(0), "Invalid address");
    LibToken._setL1RedTokenAddress(l1RdoTokenAddress);
  }

  /*************************
   * External View Functions *
   *************************/
  function gettL1RedTokenAddress() external view returns (address) {
    return LibToken.getL1RedTokenAddress();
  }

  function getBridgedERC20TokenChild(
    address erc20Address
  ) external view returns (address) {
    return LibToken.getBridgedERC20Token(erc20Address);
  }

  function getERC20TokenChild(
    address bridgedERC20Address
  ) external view returns (address) {
    return LibToken.getERC20Token(bridgedERC20Address);
  }

  function getBridgedERC721TokenChild(
    address erc721Address
  ) external view returns (address) {
    return LibToken.getBridgedERC721Token(erc721Address);
  }

  function getBridgedERC1155TokenChild(
    address erc1155Address
  ) external view returns (address) {
    return LibToken.getBridgedERC1155Token(erc1155Address);
  }

  function getERC1155TokenChild(
    address bridgedERC1155TokenAddress
  ) external view returns (address) {
    return LibToken.getERC1155Token(bridgedERC1155TokenAddress);
  }
}
