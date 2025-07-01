// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

interface IParentBridgeCore {
  function sequence() external view returns (uint256);

  event DownwardMessage(
    uint32 payloadType,
    bytes payload
  );

  event QueueTransaction(
    bytes32 indexed hash,
    uint64 indexed queueIndex,
    uint32 payloadType,
    bytes payload,
    uint256 gasLimit
  );

  function sendDownwardMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 ethAmount,
    uint256 gasLimit,
    uint256 value,
    address _refundAddress
  ) external;
}
