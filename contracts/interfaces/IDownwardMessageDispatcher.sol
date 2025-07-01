// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

interface IDownwardMessageDispatcher { 
  event RelayedMessage(
    bytes32 indexed messageHash,
    uint32 payloadType,
    bytes payload,
    uint256 nonce
  );

  function relayMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 nonce
  ) external;
}
