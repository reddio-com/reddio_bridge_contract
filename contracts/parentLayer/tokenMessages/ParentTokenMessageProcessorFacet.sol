// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../tokens/IERC20Token.sol";
import "../../tokens/IERC721Token.sol";
import "../../tokens/IERC1155Token.sol";
import {IUpwardMessageDispatcherFacet} from "../../interfaces/IUpwardMessageDispatcher.sol";
import "../../utils/Constants.sol";
import {L2MessageProof} from "../../utils/CommonStructs.sol";
import {LibParentLayerTokenStorage as LibToken} from "./LibParentLayerTokenStorage.sol";

contract ParentTokenMessageProcessorFacet is Constants {
  using SafeERC20 for IERC20Token;

  uint32 constant UPWARD_PAYLOAD_TYPE_START_AT = 0;

  enum upwardMessagePayloadType {
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
    address tokenAddress;
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

  event ParentETHUnlocked(
    address indexed childSender,
    address indexed parentRecipient,
    uint256 amount
  );

  event ParentREDUnlocked(
    address indexed tokenAddress,
    address indexed childSender,
    address indexed parentRecipient,
    uint256 amount
  );

  event ParentERC20TokenUnlocked(
    address indexed tokenAddress,
    address indexed childSender,
    address indexed parentRecipient,
    uint256 amount
  );

  event ParentERC721TokenUnlocked(
    address indexed tokenAddress,
    address indexed childSender,
    address indexed parentRecipient,
    uint256 tokenId
  );

  event ParentERC1155BatchTokenUnlocked(
    address indexed tokenAddress,
    address indexed childSender,
    address indexed parentRecipient,
    uint256[] tokenIds,
    uint256[] amounts
  );

  modifier onlySelf() {
    require(
      msg.sender == address(this),
      "ParentTokenMessageProcessorFacet: Only self allowed"
    );
    _;
  }

  function _getUpwardMessagePayloadType(
    upwardMessagePayloadType payloadType
  ) internal pure returns (uint32) {
    return UPWARD_PAYLOAD_TYPE_START_AT + uint32(payloadType);
  }

  function handleUpwardMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 nonce
  ) external onlySelf {
    if (
      payloadType ==
      _getUpwardMessagePayloadType(upwardMessagePayloadType.ParentRDOBurnt)
    ) {
      ParentRDOBurnt memory messagePayload = abi.decode(
        payload,
        (ParentRDOBurnt)
      );

      address tokenAddress = LibToken.getL1RedTokenAddress();
      require(tokenAddress != address(0), "RDO token not found");
      require(
        tokenAddress == messagePayload.tokenAddress,
        "ParentTokenMessageProcessorFacet: Invalid RDO token address"
      );

      IERC20Token(tokenAddress).safeTransfer(
        messagePayload.parentRecipient,
        messagePayload.amount
      );

      emit ParentREDUnlocked(
        messagePayload.tokenAddress,
        messagePayload.childSender,
        messagePayload.parentRecipient,
        messagePayload.amount
      );
    } else if (
      payloadType ==
      _getUpwardMessagePayloadType(
        upwardMessagePayloadType.ParentERC20TokenBurnt
      )
    ) {
      ParentERC20TokenBurnt memory messagePayload = abi.decode(
        payload,
        (ParentERC20TokenBurnt)
      );

      address tokenAddress = messagePayload.tokenAddress;

      IERC20Token(tokenAddress).safeTransfer(
        messagePayload.parentRecipient,
        messagePayload.amount
      );

      emit ParentERC20TokenUnlocked(
        tokenAddress,
        messagePayload.childSender,
        messagePayload.parentRecipient,
        messagePayload.amount
      );
    } else if (
      payloadType ==
      _getUpwardMessagePayloadType(upwardMessagePayloadType.ParentETHBurnt)
    ) {
      ParentETHBurnt memory messagePayload = abi.decode(
        payload,
        (ParentETHBurnt)
      );
      payable(messagePayload.parentRecipient).transfer(messagePayload.amount);

      emit ParentETHUnlocked(
        messagePayload.childSender,
        messagePayload.parentRecipient,
        messagePayload.amount
      );
    } else if (
      payloadType ==
      _getUpwardMessagePayloadType(
        upwardMessagePayloadType.ParentERC721TokenBurnt
      )
    ) {
      ParentERC721TokenBurnt memory messagePayload = abi.decode(
        payload,
        (ParentERC721TokenBurnt)
      );

      IERC721Token(messagePayload.tokenAddress).safeTransferFrom(
        address(this),
        messagePayload.parentRecipient,
        messagePayload.tokenId
      );

      emit ParentERC721TokenUnlocked(
        messagePayload.tokenAddress,
        messagePayload.childSender,
        messagePayload.parentRecipient,
        messagePayload.tokenId
      );
    } else if (
      payloadType ==
      _getUpwardMessagePayloadType(
        upwardMessagePayloadType.ParentERC1155BatchTokenBurnt
      )
    ) {
      ParentERC1155BatchTokenBurnt memory messagePayload = abi.decode(
        payload,
        (ParentERC1155BatchTokenBurnt)
      );

      IERC1155Token(messagePayload.tokenAddress).safeBatchTransferFrom(
        address(this),
        messagePayload.parentRecipient,
        messagePayload.tokenIds,
        messagePayload.amounts,
        ""
      );

      emit ParentERC1155BatchTokenUnlocked(
        messagePayload.tokenAddress,
        messagePayload.childSender,
        messagePayload.parentRecipient,
        messagePayload.tokenIds,
        messagePayload.amounts
      );
    } else {
      revert("Invalid Payload Type!");
    }

    IUpwardMessageDispatcherFacet(address(this)).relayMessageWithProof(
      payloadType,
      payload,
      nonce
    );
  }
}
