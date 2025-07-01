// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;
import {UpwardMessage} from "../utils/CommonStructs.sol";

interface IParentStateVerifier {
  struct AuthoritiesUpdateMessage {
    uint256 sequence;
    bytes payload;
  }

  function verifierInitialize(
    address[] memory initialAuthorities,
    uint256 initialRequiredSignaturesPercentage
  ) external;

  // Get the list of signer addresses
  function getAuthorities() external view returns (address[] memory);

  // Get the minimum signature percentage
  function getRequiredSignaturesPercentage() external view returns (uint);

  // Get the current sequence number
  function getSequence() external view returns (uint256);

  // Verify the multisignature of the upward message
  function verifyUpwardMessages(
    UpwardMessage[] calldata upwardMessages,
    bytes[] calldata signaturesArray
  ) external view returns (bool);

  // Method to update the list of signers
  function updateAuthorities(
    AuthoritiesUpdateMessage calldata message,
    bytes[] calldata signaturesArray
  ) external;
}
