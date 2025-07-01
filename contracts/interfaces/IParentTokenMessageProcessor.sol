// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

interface IParentTokenMessageProcessor {
  enum upwardMessagePayloadType {
    ParentETHBurnt,
    ParentERC20TokenBurnt,
    ParentERC721TokenBurnt,
    ParentERC1155BatchTokenBurnt,
    ParentREDTokenBurnt
  }

  // Get the upward message payload type
  function _getUpwardMessagePayloadType(
    uint32 payloadType
  ) external pure returns (uint32);

  // Event: Used to record the handling of ParentETHBurnt message
  event ParentETHUnlocked(
    address indexed childSender,
    address indexed parentRecipient,
    uint256 amount
  );

  // Event: Used to record the handling of ParentERC20TokenBurnt message
  event ParentREDTokenUnlocked(
    address indexed tokenAddress,
    address indexed childSender,
    address indexed parentRecipient,
    uint256 amount
  );

  // Event: Used to record the handling of ParentERC20TokenBurnt message
  event ParentERC20TokenUnlocked(
    address indexed tokenAddress,
    address indexed childSender,
    address indexed parentRecipient,
    uint256 amount
  );

  // Event: Used to record the handling of ParentERC721TokenBurnt message
  event ParentERC721TokenUnlocked(
    address indexed tokenAddress,
    address indexed childSender,
    address indexed parentRecipient,
    uint256 tokenId
  );

  // Event: Used to record the handling of ParentERC1155BatchTokenBurnt message
  event ParentERC1155BatchTokenUnlocked(
    address indexed tokenAddress,
    address indexed childSender,
    address indexed parentRecipient,
    uint256[] tokenIds,
    uint256[] amounts
  );

  // Used to get the address of the ERC20Token generator
  function erc20TokenGeneratorAddress() external view returns (address);

  // Used to get the mapping address of erc20TokenMap
  function erc20TokenMap(address token) external view returns (address);

  // Used to handle upward messages
  function handleUpwardMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 nonce
  ) external;
}
