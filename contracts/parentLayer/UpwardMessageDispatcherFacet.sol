// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "hardhat/console.sol";

import {IParentTokenMessageProcessor} from "../interfaces/IParentTokenMessageProcessor.sol";
import {IParentStateVerifier} from "../interfaces/IParentStateVerifier.sol";
import {UpwardMessage} from "../utils/CommonStructs.sol";
import {WithdrawTrieVerifier} from "../libraries/common/WithdrawTrieVerifier.sol";
import {Pausable} from "../utils/Pausable.sol";

contract UpwardMessageDispatcherFacet is Pausable {
  bytes32 constant Upward_Message_Dispatcher_POSITION =
    keccak256("upward.message.dispatcher.storage");

  struct UpwardMessageDispatcherStorage {
    mapping(bytes32 => bool) isL2MessageExecuted;
    mapping(uint256 => bytes32) withdrawRoots;
  }

  event RelayedMessage(
    bytes32 indexed messageHash,
    uint32 payloadType,
    bytes payload,
    uint256 nonce
  );

 modifier onlySelf() {
    require(
      msg.sender == address(this),
      "UpwardMessageDispatcher: Only self allowed"
    );
    _;
  }

  function _dispatcherStorage()
    internal
    pure
    returns (UpwardMessageDispatcherStorage storage ds)
  {
    bytes32 position = Upward_Message_Dispatcher_POSITION;
    assembly {
      ds.slot := position
    }
  }

  function _inPayloadTypeRange(
    uint32 payloadType,
    uint32 start,
    uint32 end
  ) private pure returns (bool) {
    return payloadType >= start && payloadType < end;
  }

  function _dispatchUpwardMessage(
    UpwardMessage calldata upwardMessage
  ) private {
    UpwardMessageDispatcherStorage storage ds = _dispatcherStorage();
    //require(ds.upwardSequence == upwardMessage.sequence, "Invalid sequence");

    // Find different bridge logic processing based on the range of payloadType
    if (_inPayloadTypeRange(upwardMessage.payloadType, 0, 256)) {
      IParentTokenMessageProcessor(address(this)).handleUpwardMessage(
        upwardMessage.payloadType,
        upwardMessage.payload,
        upwardMessage.nonce
      );
    }
  }

  function _encodeXDomainCalldata(
    uint32 payloadType,
    bytes calldata payload,
    uint256 messageNonce
  ) internal pure returns (bytes memory) {
    return
      abi.encode(
        payloadType,
        payload,
        messageNonce
      );
  }

  function isL2MessageExecuted(bytes32 hash) external view returns(bool) {
    UpwardMessageDispatcherStorage storage ds = _dispatcherStorage();
    return ds.isL2MessageExecuted[hash];
  }

  function relayMessageWithProof(
    uint32 payloadType,
    bytes calldata payload,
    uint256 nonce
  ) external onlySelf
  //whenNotPaused notInExecution 
  {
    UpwardMessageDispatcherStorage storage ds = _dispatcherStorage();
    bytes32 xDomainCalldataHash = keccak256(_encodeXDomainCalldata(payloadType, payload, nonce));
    require(!ds.isL2MessageExecuted[xDomainCalldataHash], "Message was already successfully executed");

    ds.isL2MessageExecuted[xDomainCalldataHash] = true;
    emit RelayedMessage(xDomainCalldataHash, payloadType, payload, nonce);
  }

  function receiveUpwardMessages(
    UpwardMessage[] calldata upwardMessages,
    bytes[] memory signaturesArray
  )  external whenNotPaused {
    IParentStateVerifier stateProver = IParentStateVerifier(address(this));

    require(
      stateProver.verifyUpwardMessages(upwardMessages, signaturesArray),
      "Invalid signatures"
    );
    
    for (uint256 index = 0; index < upwardMessages.length; index++) {
      _dispatchUpwardMessage(upwardMessages[index]);
    }
  }
}
