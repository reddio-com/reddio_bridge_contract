// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import "hardhat/console.sol";

import {IChildGasPriceOracleFacet} from "../interfaces/message/IChildGasPriceOracle.sol";
import {LibPausable} from "../utils/Pausable.sol";
import {Pausable} from "../utils/Pausable.sol";
import {LibParentLayerTokenStorage as LibToken} from "./tokenMessages/LibParentLayerTokenStorage.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

contract ParentBridgeCoreFacet is Pausable {
  bytes32 constant PARENT_LAYER_BRIDGE_CORE_STORAGE_POSITION =
    keccak256("parent.bridge.core.storage");

  struct L2MessageProof {
    // The index of the batch where the message belongs to.
    uint256 batchIndex;
    // Concatenation of merkle proof for withdraw merkle trie.
    bytes merkleProof;
  }

  struct ParentLayerBridgeCoreStorage {
    bytes32[] messageQueue;
    //mapping(bytes32 => uint256) messageSendTimestamp;
    uint256 lastFinalizedBatchIndex;
    address xDomainMessageSender;
    address feeVault;

  }

  event DownwardMessage(uint32 payloadType, bytes payload);

  event RelayedMessage(bytes32 indexed messageHash);

  event QueueTransaction(
    bytes32 indexed hash,
    uint64 indexed queueIndex,
    uint32 payloadType,
    bytes payload,
    uint256 gasLimit
  );

  modifier onlySelf() {
    require(
      msg.sender == address(this),
      "ParentBridgeCoreFacet: Only self allowed"
    );
    _;
  }
  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
    _;
  }

  function _bridgeCoreStorage()
    internal
    pure
    returns (ParentLayerBridgeCoreStorage storage bs)
  {
    bytes32 position = PARENT_LAYER_BRIDGE_CORE_STORAGE_POSITION;
    assembly {
      bs.slot := position
    }
  }

  function _encodeXDomainCalldata(
    uint32 payloadType,
    bytes calldata payload,
    uint256 messageNonce
  ) internal pure returns (bytes memory) {
    return abi.encode(payloadType, payload, messageNonce);
  }

  function _queueTransaction(
    uint32 payloadType,
    bytes calldata payload,
    uint256 _gasLimit
  ) internal {
    ParentLayerBridgeCoreStorage storage ds = _bridgeCoreStorage();
    // compute transaction hash
    uint256 queueIndex = ds.messageQueue.length;

    bytes32 hash = keccak256(
      _encodeXDomainCalldata(payloadType, payload, queueIndex)
    ); // _gasLimit
    ds.messageQueue.push(hash);

    // emit event
    emit QueueTransaction(
      hash,
      uint64(queueIndex),
      payloadType,
      payload,
      _gasLimit
    );
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

  function nextCrossDomainMessageIndex() public view returns (uint256) {
    ParentLayerBridgeCoreStorage storage ds = _bridgeCoreStorage();
    return ds.messageQueue.length;
  }

  function appendCrossDomainMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 _gasLimit //onlyMessenger
  ) internal {
    // validate gas limit
    //_validateGasLimit(_gasLimit, _data);

    // do address alias to avoid replay attack in L2.
    //address _sender = AddressAliasHelper.applyL1ToL2Alias(_msgSender());

    _queueTransaction(payloadType, payload, _gasLimit);
  }

  /// @notice send message to child
  /// @dev This function can only called by contract owner.
  /// @param ethAmount the amount of token to transfer, in wei.
  /// @param gasLimit  gas limit required to complete the deposit on L2
  /// @param value msg.value.
  function sendDownwardMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 ethAmount,
    uint256 gasLimit,
    uint256 value,
    address _refundAddress
  ) external onlySelf whenNotPaused {
    // compute and deduct the messaging fee to fee vault.
    uint256 fee = estimateCrossMessageFee(payloadType,gasLimit);
    require(value >= fee + ethAmount, "Insufficient msg.value");
    ParentLayerBridgeCoreStorage storage ds = _bridgeCoreStorage();
    if (fee > 0) {
        require(
            ds.feeVault != address(0),
            "Fee vault address is not set");
        (bool _success, ) = ds.feeVault.call{value: fee}("");
        require(_success, "Failed to deduct the fee");
    }

    appendCrossDomainMessage(payloadType, payload, gasLimit);

    emit DownwardMessage(payloadType, payload);
    unchecked {
        uint256 _refund = value - fee - ethAmount;
        if (_refund > 0) {
            (bool _success, ) = _refundAddress.call{value: _refund}("");
            require(_success, "Failed to refund the fee");
        }
    }
  }

  function setL1RedTokenAddress(address l1RdoTokenAddress) external onlyOwner{
    require(l1RdoTokenAddress != address(0), "Invalid address");
    LibToken._setL1RedTokenAddress(l1RdoTokenAddress);
  }

  function setFeeVault(address newFeeVault) external onlyOwner {
      require(newFeeVault != address(0), "Invalid feeVault address");
      ParentLayerBridgeCoreStorage storage ds = _bridgeCoreStorage();
      ds.feeVault = newFeeVault;
  }

  function estimateCrossMessageFee(uint32 _payloadType, 
    uint256 _gasLimit
  ) public view returns (uint256) {
    return
      IChildGasPriceOracleFacet(address(this)).estimateCrossDomainMessageFee(
        _payloadType,
        _gasLimit
      );
  }

  /*************************
   * External View Functions *
   *************************/
  function getRdoTokenAddress() external view returns (address) {
    return LibToken.getL1RedTokenAddress();
  }

  /// @notice Returns the current feeVault address.
  /// @return The current feeVault address.
  function getFeeVault() external view returns (address) {
      ParentLayerBridgeCoreStorage storage ds = _bridgeCoreStorage();
      return ds.feeVault;
  }
}
