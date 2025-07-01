// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import "hardhat/console.sol";

import {IParentBridgeCore} from "../../interfaces/IParentBridgeCore.sol";
import {IERC20Token} from "../../tokens/IERC20Token.sol";
import {IERC721Token} from "../../tokens/IERC721Token.sol";
import {IERC1155Token} from "../../tokens/IERC1155Token.sol";
import {Pausable} from "../../utils/Pausable.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {ParentTokenMessageTransmitterStorage} from "../../storage/parentLayer/ParentTokenMessageTransmitterStorage.sol";


import {LibParentLayerTokenStorage as LibToken} from "./LibParentLayerTokenStorage.sol";

contract ParentTokenMessageTransmitterFacet is Pausable, IERC721Receiver {
  using SafeERC20 for IERC20Token;
  uint32 constant DOWANWARD_PAYLOAD_TYPE_START_AT = 0;


  enum DownwardMessagePayloadType {
    ParentETHLocked,
    ParentERC20TokenLocked,
    ParentERC721TokenLocked,
    ParentERC1155TokenLocked,
    ParentREDTokenLocked
  }

  // Parent layer network native Token -> Sent from parent layer network to child layer network
  struct ETHLocked {
    address parentSender;
    address childRecipient;
    uint256 amount;
  }

  // Parent layer network RDO -> Sent from parent layer network to child layer network
  struct ParentREDTokenLocked {
    address tokenAddress;
    address parentSender;
    address childRecipient;
    uint256 amount;
  }

  // Parent layer network issued ERC20 -> Sent from parent layer network to child layer network
  struct ParentERC20TokenLocked {
    address tokenAddress;
    string tokenName;
    string tokenSymbol;
    uint8 decimals;
    address parentSender;
    address childRecipient;
    uint256 amount;
  }

  // Parent layer network issued ERC721 -> Sent from parent layer network to child layer network
  struct ParentERC721TokenLocked {
    address tokenAddress;
    string tokenName;
    string tokenSymbol;
    address parentSender;
    address childRecipient;
    uint256 tokenId;
  }

  // Parent layer network issued ERC1155 -> Sent from parent layer network to child layer network
  struct ParentERC1155TokenLocked {
    address tokenAddress;
    address parentSender;
    address childRecipient;
    uint256[] tokenIds;
    uint256[] amounts;
  }

  function getDownwardMessagePayloadType(
    DownwardMessagePayloadType payloadType
  ) internal pure returns (uint32) {
    return DOWANWARD_PAYLOAD_TYPE_START_AT + uint32(payloadType);
  }

  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
    _;
  }


  function depositETH(
    address recipient,
    uint256 amount,
    uint256 gasLimit
  ) external payable whenNotPaused {
    require(isTokenEnabled(ParentTokenMessageTransmitterStorage.ETH_ADDRESS), "Deposit this token is disabled");
    IParentBridgeCore bridgeCore = IParentBridgeCore(address(this));
    require(msg.value > 0, "can't deposit zero amount");

    bytes memory payload = abi.encode(
      ETHLocked({
        parentSender: msg.sender,
        childRecipient: recipient,
        amount: amount
      })
    );

    bridgeCore.sendDownwardMessage(
      getDownwardMessagePayloadType(DownwardMessagePayloadType.ParentETHLocked),
      payload,
      amount,
      gasLimit,
      msg.value,
      msg.sender
    );
  }

  function depositRED(
    address recipient,
    uint256 amount,
    uint256 gasLimit
  ) external payable {

    address tokenAddress = LibToken.getL1RedTokenAddress();
    require(tokenAddress != address(0), "RDO token not found");
    require(isTokenEnabled(tokenAddress), "Deposit this token is disabled");

    require(amount > 0, "can't deposit zero amount");

    IERC20Token erc20Token = IERC20Token(tokenAddress);
    uint256 balanceBefore = erc20Token.balanceOf(address(this));
    erc20Token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 actualAmount = erc20Token.balanceOf(address(this)) - balanceBefore;    require(amount > 0, "deposit zero eth");

    IParentBridgeCore bridgeCore = IParentBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentREDTokenLocked({
        tokenAddress: tokenAddress,
        parentSender: msg.sender,
        childRecipient: recipient,
        amount: actualAmount
      })  
    );

    bridgeCore.sendDownwardMessage(
      getDownwardMessagePayloadType(
        DownwardMessagePayloadType.ParentREDTokenLocked
      ),
      payload,
      0,
      gasLimit,
      msg.value,
      msg.sender
    );
  }

  function depositERC20Token(
    address tokenAddress,
    address recipient,
    uint256 amount,
    uint256 gasLimit
  ) external payable {
    address redAddress = LibToken.getL1RedTokenAddress();

    require(
        tokenAddress != redAddress,
        "you need to use depositRED for RDO token"
    );

    require(amount > 0, "cant deposit zero amount");
    require(isTokenEnabled(tokenAddress), "Deposit this token is disabled");


    IERC20Token erc20Token = IERC20Token(tokenAddress);
    uint256 beforeBalance = erc20Token.balanceOf(address(this));

    erc20Token.safeTransferFrom(msg.sender, address(this), amount);
    amount = erc20Token.balanceOf(address(this)) - beforeBalance;

    IParentBridgeCore bridgeCore = IParentBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentERC20TokenLocked({
        tokenAddress: tokenAddress,
        tokenName: erc20Token.name(),
        tokenSymbol: erc20Token.symbol(),
        decimals: erc20Token.decimals(),
        parentSender: msg.sender,
        childRecipient: recipient,
        amount: amount
      })
    );

    bridgeCore.sendDownwardMessage(
      getDownwardMessagePayloadType(
        DownwardMessagePayloadType.ParentERC20TokenLocked
      ),
      payload,
      0,
      gasLimit,
      msg.value,
      msg.sender
    );
  }

  function depositERC721Token(
    address tokenAddress,
    address recipient,
    uint256 tokenId,
    uint256 gasLimit
  ) external payable {
    require(isTokenEnabled(tokenAddress), "Deposit this token is disabled");
    IERC721Token erc721Token = IERC721Token(tokenAddress);
    erc721Token.safeTransferFrom(msg.sender, address(this), tokenId);

    IParentBridgeCore bridgeCore = IParentBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentERC721TokenLocked({
        tokenAddress: tokenAddress,
        tokenName: erc721Token.name(),
        tokenSymbol: erc721Token.symbol(),
        parentSender: msg.sender,
        childRecipient: recipient,
        tokenId: tokenId
      }),
      0
    );

    bridgeCore.sendDownwardMessage(
      getDownwardMessagePayloadType(
        DownwardMessagePayloadType.ParentERC721TokenLocked
      ),
      payload,
      0,
      gasLimit,
      msg.value,
      msg.sender
    );
  }

  function depositERC1155Token(
    address tokenAddress,
    address recipient,
    uint256[] memory tokenIds,
    uint256[] memory amounts,
    uint256 gasLimit
  ) external payable {
    require(isTokenEnabled(tokenAddress), "Deposit this token is disabled");

    IERC1155Token erc1155Token = IERC1155Token(tokenAddress);
    erc1155Token.safeBatchTransferFrom(
      msg.sender,
      address(this),
      tokenIds,
      amounts,
      ""
    );

    IParentBridgeCore bridgeCore = IParentBridgeCore(address(this));
    bytes memory payload = abi.encode(
      ParentERC1155TokenLocked({
        tokenAddress: tokenAddress,
        tokenIds: tokenIds,
        amounts: amounts,
        parentSender: msg.sender,
        childRecipient: recipient
      })
    );

    bridgeCore.sendDownwardMessage(
      getDownwardMessagePayloadType(
        DownwardMessagePayloadType.ParentERC1155TokenLocked
      ),
      payload,
      0,
      gasLimit,
      msg.value,
      msg.sender
    );
  }

function setTokenEnabled(address token, bool enabled) external onlyOwner {
    ParentTokenMessageTransmitterStorage.Layout storage l = ParentTokenMessageTransmitterStorage.layout();

    l.enabledTokens[token] = enabled;
}

function isTokenEnabled(address token) public view returns (bool) {
    ParentTokenMessageTransmitterStorage.Layout storage l = ParentTokenMessageTransmitterStorage.layout();

    return l.enabledTokens[token];
}

  function onERC721Received(
    address,
    address,
    uint256,
    bytes memory
  ) public virtual returns (bytes4) {
    return this.onERC721Received.selector;
  }

  function onERC1155Received(
    address,
    address,
    uint256,
    uint256,
    bytes memory
  ) public returns (bytes4) {
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address,
    address,
    uint256[] memory,
    uint256[] memory,
    bytes memory
  ) public returns (bytes4) {
    return this.onERC1155BatchReceived.selector;
  }
}
