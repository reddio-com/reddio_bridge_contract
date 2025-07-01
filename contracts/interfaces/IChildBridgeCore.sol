// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

interface IChildBridgeCore {
  event UpwardMessage(
    uint32 payloadType,
    bytes payload
  );

  event SentMessage(
    bytes32 indexed xDomainCalldataHash,
    uint256 nonce,
    uint32 payloadType,
    bytes payload,
    uint256 gasLimit
  );

  function sendUpwardMessage(
    uint32 payloadType,
    bytes calldata payload
  ) external;
}
