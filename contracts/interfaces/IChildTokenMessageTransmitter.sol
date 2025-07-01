// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

interface IChildTokenMessageTransmitter {
  enum UpwardMessagePayloadType {
    ParentETHBurnt,
    ParentERC20TokenBurnt,
    ParentERC721TokenBurnt,
    ParentERC1155BatchTokenBurnt,
    ParentRDOBurnt
  }

  struct ParentETHBurnt {
    address childSender;
    address parentRecipient;
    uint256 amount;
  }

  struct ParentRDOBurnt {
    address childSender;
    address parentRecipient;
    uint256 amount;
  }

  struct ParentERC20TokenBurnt {
    address tokenAddress;
    address childSender;
    address parentRecipient;
    uint256 amount;
  }
  struct ParentERC721TokenBurnt {
    address tokenAddress;
    address childSender;
    address parentRecipient;
    uint256 tokenId;
  }

  struct ParentERC1155BatchTokenBurnt {
    address tokenAddress;
    address childSender;
    address parentRecipient;
    uint256[] tokenIds;
    uint256[] amounts;
  }

  function getUpwardMessagePayloadType(
    UpwardMessagePayloadType payloadType
  ) external pure returns (uint32);

  function withdrawETH(address recipient, uint256 amount) external;

  function withdrawERC20Token(
    address tokenAddress,
    address recipient,
    uint256 amount
  ) external;

  function withdrawERC721Token(
    address tokenAddress,
    address recipient,
    uint256 tokenId
  ) external;

  function withdrawERC1155BatchToken(
    address tokenAddress,
    address recipient,
    uint256[] calldata tokenIds,
    uint256[] calldata amounts
  ) external;
}
