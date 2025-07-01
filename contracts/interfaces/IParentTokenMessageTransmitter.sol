// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

interface IParentTokenMessageTransmitter {
  enum DownwardMessagePayloadType {
    ParentETHLocked,
    ParentERC20TokenLocked,
    ParentERC721TokenLocked,
    ParentERC1155TokenLocked,
    ParentREDTokenLocked
  }

  struct ParentETHLocked {
    address parentSender;
    address childRecipient;
    uint256 amount;
  }

  struct ParentREDTokenLocked {
    address tokenAddress;
    address parentSender;
    address childRecipient;
    uint256 amount;
  }

  struct ParentERC20TokenLocked {
    address tokenAddress;
    address parentSender;
    address childRecipient;
    uint256 amount;
  }

  struct ParentERC721TokenLocked {
    address tokenAddress;
    address parentSender;
    address childRecipient;
    uint256 tokenId;
  }

  struct ParentERC1155TokenLocked {
    address tokenAddress;
    address parentSender;
    address childRecipient;
    uint256[] tokenIds;
    uint256[] amounts;
  }

  function depositETH(
    address recipient,
    uint256 amount,
    uint256 gasLimit
  ) external payable;

  function depositRED(
    address recipient,
    uint256 amount,
    uint256 gasLimit
  ) external;

  function depositERC20Token(
    address tokenAddress,
    address recipient,
    uint256 amount,
    uint256 gasLimit
  ) external;

  function depositERC721Token(
    address tokenAddress,
    address recipient,
    uint256 tokenId,
    uint256 gasLimit
  ) external;

  function depositERC1155Token(
    address tokenAddress,
    address recipient,
    uint256[] memory tokenIds,
    uint256[] memory amounts,
    uint256 gasLimit
  ) external;
}
