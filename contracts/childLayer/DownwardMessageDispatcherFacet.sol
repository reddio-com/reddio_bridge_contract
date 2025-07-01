// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;
import "hardhat/console.sol";

import {DownwardMessage} from "../utils/CommonStructs.sol";
import {IChildTokenMessageProcessor} from "../interfaces/IChildTokenMessageProcessor.sol";
import {Pausable} from "../utils/Pausable.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

contract DownwardMessageDispatcherFacet is Pausable {
  bytes32 constant Downward_Message_Dispatcher_POSITION =
    keccak256("downward.message.dispatcher.storage");

  struct DownwardMessageDispatcherStorage {
    mapping(bytes32 => bool) isL1MessageExecuted;
    address xDomainMessageSender;
    address systemAddress;
  }

  event RelayedMessage(
    bytes32 indexed messageHash,
    uint32 payloadType,
    bytes payload,
    uint256 nonce
  );

  event SystemAddressUpdated(address oldAddress, address newAddress);

  function _dispatcherStorage()
    internal
    pure
    returns (DownwardMessageDispatcherStorage storage ds)
  {
    bytes32 position = Downward_Message_Dispatcher_POSITION;
    assembly {
      ds.slot := position
    }
  }

  modifier onlySystem() {
    //require(msg.sender == SYSTEM_ADDRESS, "Only system can call this function");
    DownwardMessageDispatcherStorage storage ds = _dispatcherStorage();
    require(
      msg.sender == ds.systemAddress,
      "Only system can call this function"
    );

    _;
  }
  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
    _;
  }

  modifier onlySelf() {
      require(
        msg.sender == address(this),
        "DownwardMessageDispatcherFacet: Only self allowed"
      );
      _;
  }

  function setSystemAddress(address newSystemAddress) external onlyOwner {
    require(newSystemAddress != address(0), "Invalid address");
    DownwardMessageDispatcherStorage storage ds = _dispatcherStorage();
    emit SystemAddressUpdated(ds.systemAddress, newSystemAddress);
    ds.systemAddress = newSystemAddress;
  }

  function _inPayloadTypeRange(
    uint32 payloadType,
    uint32 start,
    uint32 end
  ) private pure returns (bool) {
    return payloadType >= start && payloadType < end;
  }

  function _dispatchDownwardMessage(
    DownwardMessage calldata downwardMessage
  ) private {
    DownwardMessageDispatcherStorage storage ds = _dispatcherStorage();
    // require(
    //   ds.downwardSequence == downwardMessage.sequence,
    //   "Invalid sequence"
    // );

    // Find different bridge logic processing based on the range of payloadType
    if (_inPayloadTypeRange(downwardMessage.payloadType, 0, 256)) {
      IChildTokenMessageProcessor(address(this)).handleDownwardMessage(
        downwardMessage.payloadType,
        downwardMessage.payload,
        downwardMessage.nonce
      );
    }
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

  function isL1MessageExecuted(bytes32 hash) external view returns (bool) {
    DownwardMessageDispatcherStorage storage ds = _dispatcherStorage();
    return ds.isL1MessageExecuted[hash];
  }

  function relayMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 nonce //whenNotPaused
  ) external onlySelf{
    // It is impossible to deploy a contract with the same address, reentrance is prevented in nature.
    //require(AddressAliasHelper.undoL1ToL2Alias(_msgSender()) == counterpart, "Caller is not L1ScrollMessenger");
    DownwardMessageDispatcherStorage storage ds = _dispatcherStorage();

    bytes32 xDomainCalldataHash = keccak256(
      _encodeXDomainCalldata(payloadType, payload, nonce)
    );

    require(
      !ds.isL1MessageExecuted[xDomainCalldataHash],
      "Message was already successfully executed"
    );
    ds.isL1MessageExecuted[xDomainCalldataHash] = true;

    emit RelayedMessage(xDomainCalldataHash, payloadType, payload, nonce);
  }

  // Called through events watcher, requires permission control in actual scenarios, only accepts system calls
  function receiveDownwardMessages(
    DownwardMessage[] calldata downwardMessages
  ) external onlySystem whenNotPaused {
    for (uint256 index = 0; index < downwardMessages.length; index++) {
      _dispatchDownwardMessage(downwardMessages[index]);
    }
  }
}
