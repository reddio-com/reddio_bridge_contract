// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;


struct L2MessageProof {
  // The index of the batch where the message belongs to.
  uint256 batchIndex;
  // Concatenation of merkle proof for withdraw merkle trie.
  bytes merkleProof;
}

struct UpwardMessage {
  uint32 payloadType;
  bytes payload;
  uint256 nonce;
}

struct DownwardMessage {
  uint32 payloadType;
  bytes payload;
  uint256 nonce;
}
