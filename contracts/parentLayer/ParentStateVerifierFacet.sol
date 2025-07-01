// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;
import {UpwardMessage} from "../utils/CommonStructs.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import "hardhat/console.sol";

contract ParentStateVerifierFacet {
  bytes32 constant PARENT_STATE_VERIFIER_STORAGE_POSITION =
    keccak256("parent.state.verifier.storage");

  struct ParentStateVerifierStorage {
    // List of signer addresses
    address[] authorities;
    // Minimum signature percentage
    uint256 requiredSignaturesPercentage;
    uint256 upwardSequence;
    bool initialized;
  }

  function _stateVerifierStorage()
    internal
    pure
    returns (ParentStateVerifierStorage storage ss)
  {
    bytes32 position = PARENT_STATE_VERIFIER_STORAGE_POSITION;
    assembly {
      ss.slot := position
    }
  }
  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
    _;
  }
  // Initialization function to set initial authorities and required signature percentage
  function verifierInitialize(
    address[] memory initialAuthorities,
    uint256 initialRequiredSignaturesPercentage
  ) external onlyOwner{
    ParentStateVerifierStorage storage ss = _stateVerifierStorage();

    require(!ss.initialized, "Already initialized");
    require(
      initialRequiredSignaturesPercentage > 0 &&
        initialRequiredSignaturesPercentage <= 100,
      "Invalid signature percentage"
    );

    ss.authorities = initialAuthorities;
    ss.requiredSignaturesPercentage = initialRequiredSignaturesPercentage;
    ss.initialized = true;
  }

  // Get the list of signer addresses
  function getAuthorities() external view returns (address[] memory) {
    ParentStateVerifierStorage storage ss = _stateVerifierStorage();
    return ss.authorities;
  }

  // Get the minimum signature percentage
  function getRequiredSignaturesPercentage() external view returns (uint) {
    ParentStateVerifierStorage storage ss = _stateVerifierStorage();
    return ss.requiredSignaturesPercentage;
  }

  // Get the current sequence number
  function getSequence() external view returns (uint256) {
    ParentStateVerifierStorage storage ss = _stateVerifierStorage();
    return ss.upwardSequence;
  }

  struct AuthoritiesUpdateMessage {
    uint256 sequence;
    bytes payload;
  }

  // Verify the multisignature of the upward message
  function verifyUpwardMessages(
    UpwardMessage[] memory upwardMessages,
    bytes[] memory signaturesArray
  ) public view returns (bool) {
    bytes32 dataHash = keccak256(abi.encode(upwardMessages));
    return verifySignatures(dataHash, signaturesArray);
  }

  function verifySignatures(
    bytes32 dataHash,
    bytes[] memory signaturesArray
  ) internal view returns (bool) {
    ParentStateVerifierStorage storage ss = _stateVerifierStorage();

    uint validSignatures = 0;
    uint requiredSignatures = (ss.authorities.length *
      ss.requiredSignaturesPercentage) / 100;
    address[] memory seenSigners = new address[](ss.authorities.length);
    for (uint i = 0; i < signaturesArray.length; i++) {
      bytes memory sig = signaturesArray[i];
      address signer = recoverSigner(dataHash, sig);
      if (isAuthority(signer) && !hasSigned(seenSigners, signer)) {
        validSignatures++;
        seenSigners[validSignatures - 1] = signer;
        if (validSignatures >= requiredSignatures) {
          return true;
        }
      }
    }
    return false;
  }

  // Check if the signer is valid
  function isAuthority(address signer) internal view returns (bool) {
    ParentStateVerifierStorage storage ss = _stateVerifierStorage();

    for (uint i = 0; i < ss.authorities.length; i++) {
      if (ss.authorities[i] == signer) {
        return true;
      }
    }
    return false;
  }

  // Check if the signer has already signed
  function hasSigned(
    address[] memory seenSigners,
    address signer
  ) internal pure returns (bool) {
    for (uint i = 0; i < seenSigners.length; i++) {
      if (seenSigners[i] == signer) {
        return true;
      }
    }
    return false;
  }

  function recoverSigner(
    bytes32 dataHash,
    bytes memory signature
  ) internal pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;

    require(signature.length == 65, "Invalid signature length");

    assembly {
      r := mload(add(signature, 0x20))
      s := mload(add(signature, 0x40))
      v := byte(0, mload(add(signature, 0x60)))
    }

    if (v < 27) {
      v += 27;
    }

    require(v == 27 || v == 28, "Invalid signature version");

    return ecrecover(dataHash, v, r, s);
  }

  // Method to update the list of signers
  function updateAuthorities(
    AuthoritiesUpdateMessage memory message,
    bytes[] memory signaturesArray
  ) public onlyOwner{
    ParentStateVerifierStorage storage ss = _stateVerifierStorage();
    // Verify the sequence of the upward message
    require(message.sequence == ss.upwardSequence + 1, "Invalid sequence");
    ss.upwardSequence = message.sequence;

    // Verify signatures
    bytes32 messageHash = keccak256(
      abi.encode(message.sequence, message.payload)
    );
    require(
      verifySignatures(messageHash, signaturesArray),
      "Invalid signatures"
    );

    // Decode payload
    address[] memory newAuthorities = abi.decode(message.payload, (address[]));

    // Update the list of signers
    delete ss.authorities;
    for (uint i = 0; i < newAuthorities.length; i++) {
      ss.authorities.push(newAuthorities[i]);
    }
  }
  function getDataHash(UpwardMessage[] memory messages) public pure returns (bytes32) {
    return keccak256(abi.encode(messages));
  }

}

