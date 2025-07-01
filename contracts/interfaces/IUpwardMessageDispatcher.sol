// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

interface IUpwardMessageDispatcherFacet { 
  event RelayedMessage(
    bytes32 indexed messageHash,
    uint32 payloadType,
    bytes payload,
    uint256 nonce
  );

  function relayMessageWithProof(
    uint32 payloadType,
    bytes calldata payload,
    uint256 nonce
  ) external;

  function isL2MessageExecuted(bytes32 hash) external view returns(bool);
}
