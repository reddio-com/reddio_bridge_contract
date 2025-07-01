// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "../../interfaces/IChildBridgeCore.sol";
import {IERC20Token} from "../../tokens/IERC20Token.sol";
import {IERC721Token} from "../../tokens/IERC721Token.sol";
import {IERC1155Token} from "../../tokens/IERC1155Token.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LibChildLayerTokenStorage as LibToken} from "./LibChildLayerTokenStorage.sol";
import "../../utils/Constants.sol";
import {Pausable} from "../../utils/Pausable.sol";
import {ReentrancyGuard} from "../../utils/ReentrancyGuard.sol";

contract ChildTokenMessageTransmitterFacet is Constants, Pausable, ReentrancyGuard {
  uint32 constant UPWARD_PAYLOAD_TYPE_START_AT = 0;

  enum UpwardMessagePayloadType {
    ParentETHBurnt,
    ParentErc20TokenBurnt,
    ParentErc721TokenBurnt,
    ParentErc1155BatchTokenBurnt,
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
  struct ParentErc20TokenBurnt {
    address tokenAddress;
    address childSender;
    address parentRecipient;
    uint256 amount;
  }

  struct ParentErc721TokenBurnt {
    address tokenAddress;
    address childSender;
    address parentRecipient;
    uint256 tokenId;
  }

  struct ParentErc1155BatchTokenBurnt {
    address tokenAddress;
    address childSender;
    address parentRecipient;
    uint256[] tokenIds;
    uint256[] amounts;
  }

  function getUpwardMessagePayloadType(
    UpwardMessagePayloadType payloadType
  ) internal pure returns (uint32) {
    return UPWARD_PAYLOAD_TYPE_START_AT + uint32(payloadType);
  }

  function withdrawRDO(address recipient) external payable whenNotPaused {
    require(msg.value > 0, "withdraw zero rdo");
    address tokenAddress = LibToken.getL1RedTokenAddress();
    require(tokenAddress != address(0), "RDO token not found");
    IChildBridgeCore bridge = IChildBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentRDOBurnt({
        tokenAddress: tokenAddress,
        childSender: msg.sender,
        parentRecipient: recipient,
        amount: msg.value
      })
    );

    bridge.sendUpwardMessage(
      getUpwardMessagePayloadType(UpwardMessagePayloadType.ParentRDOBurnt),
      payload
    );
  }

  function withdrawETH(
    address recipient,
    uint256 amount
  ) external whenNotPaused nonReentrant {
    address bridgedTokenAddress = LibToken.getBridgedERC20Token(
      PARENT_NATIVE_TOKEN_ADDRESS
    );

    IERC20Token bridgedERC20Token = IERC20Token(bridgedTokenAddress);

    bridgedERC20Token.burn(msg.sender, amount);

    IChildBridgeCore bridge = IChildBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentETHBurnt({
        childSender: msg.sender,
        parentRecipient: recipient,
        amount: amount
      })
    );

    bridge.sendUpwardMessage(
      getUpwardMessagePayloadType(UpwardMessagePayloadType.ParentETHBurnt),
      payload
    );
  }

  function withdrawErc20Token(
    address tokenAddress,
    address recipient,
    uint256 amount
  ) external whenNotPaused nonReentrant {
    address rdoAddress = LibToken.getL1RedTokenAddress();
    require(tokenAddress != rdoAddress, "RDO token not allowed");

    address bridgedTokenAddress = LibToken.getBridgedERC20Token(tokenAddress);
    IERC20Token bridgedErc20Token = IERC20Token(bridgedTokenAddress);
    bridgedErc20Token.burn(msg.sender, amount);

    IChildBridgeCore bridge = IChildBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentErc20TokenBurnt({
        tokenAddress: tokenAddress,
        childSender: msg.sender,
        parentRecipient: recipient,
        amount: amount
      })
    );

    bridge.sendUpwardMessage(
      getUpwardMessagePayloadType(
        UpwardMessagePayloadType.ParentErc20TokenBurnt
      ),
      payload
    );
  }

  function withdrawErc721Token(
    address tokenAddress,
    address recipient,
    uint256 tokenId
  ) external whenNotPaused nonReentrant {
    address bridgedTokenAddress = LibToken.getBridgedERC721Token(tokenAddress);
    IERC721Token bridgedErc721Token = IERC721Token(bridgedTokenAddress);
    bridgedErc721Token.burn(msg.sender, tokenId);

    IChildBridgeCore bridge = IChildBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentErc721TokenBurnt({
        tokenAddress: tokenAddress,
        childSender: msg.sender,
        parentRecipient: recipient,
        tokenId: tokenId
      })
    );

    bridge.sendUpwardMessage(
      getUpwardMessagePayloadType(
        UpwardMessagePayloadType.ParentErc721TokenBurnt
      ),
      payload
    );
  }

  function withdrawErc1155BatchToken(
    address tokenAddress,
    address recipient,
    uint256[] calldata tokenIds,
    uint256[] calldata amounts
  ) external whenNotPaused nonReentrant {
    address bridgedTokenAddress = LibToken.getBridgedERC1155Token(tokenAddress);
    IERC1155Token erc1155Token = IERC1155Token(bridgedTokenAddress);
    erc1155Token.burnBatch(msg.sender, tokenIds, amounts);

    IChildBridgeCore bridge = IChildBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentErc1155BatchTokenBurnt({
        tokenAddress: tokenAddress,
        childSender: msg.sender,
        parentRecipient: recipient,
        tokenIds: tokenIds,
        amounts: amounts
      })
    );

    bridge.sendUpwardMessage(
      getUpwardMessagePayloadType(
        UpwardMessagePayloadType.ParentErc1155BatchTokenBurnt
      ),
      payload
    );
  }
}
