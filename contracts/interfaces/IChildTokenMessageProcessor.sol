// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Token} from "../tokens/IERC20Token.sol";
import {IERC721Token} from "../tokens/IERC721Token.sol";
import {IERC1155Token} from "../tokens/IERC1155Token.sol";

interface IChildTokenMessageProcessor {
  enum DownwardMessagePayloadType {
    ETHLocked,
    ParentERC20TokenLocked,
    ParentERC721TokenLocked,
    ParentERC1155BatchTokenLocked,
    ParentRDOLocked
  }

  struct ETHLocked {
    address parentSender;
    address childRecipient;
    uint256 amount;
  }
  struct ParentRDOLocked {
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

  struct ParentERC1155BatchTokenLocked {
    address tokenAddress;
    address parentSender;
    address childRecipient;
    uint256[] tokenIds;
    uint256[] amounts;
  }

  function bridgedERC20TokenMap(
    address tokenAddress
  ) external view returns (address);

  function erc20TokenMap(address tokenAddress) external view returns (address);

  function bridgedERC721TokenMap(
    address tokenAddress
  ) external view returns (address);

  function erc721TokenMap(address tokenAddress) external view returns (address);

  function bridgedERC1155TokenMap(
    address tokenAddress
  ) external view returns (address);

  function erc1155TokenMap(
    address tokenAddress
  ) external view returns (address);

  function handleDownwardMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 nonce
  ) external;
}
