// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import {IERC20Token} from "../../tokens/IERC20Token.sol";
import {IERC721Token} from "../../tokens/IERC721Token.sol";
import {IERC1155Token} from "../../tokens/IERC1155Token.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LibChildLayerTokenStorage as LibToken} from "./LibChildLayerTokenStorage.sol";
import {IDownwardMessageDispatcher} from "../../interfaces/IDownwardMessageDispatcher.sol";

import "../../interfaces/IERC20TokenFactory.sol";
import "../../interfaces/IERC721TokenFactory.sol";
import "../../interfaces/IERC1155TokenFactory.sol";
import "../../utils/Constants.sol";

contract ChildTokenMessageProcessorFacet is Constants {
  using SafeERC20 for IERC20Token;

  uint32 constant PAYLOAD_TYPE_START_AT = 0;
  /// @notice The safe gas limit for RDO transfer
  uint256 private constant SAFE_RED_TRANSFER_GAS_LIMIT  = 100000;

  enum DownwardMessagePayloadType {
    ETHLocked,
    ParentERC20TokenLocked,
    ParentERC721TokenLocked,
    ParentERC1155BatchTokenLocked,
    ParentREDLocked
  }

  // Parent layer network native Token -> Sent from parent layer network to child layer network
  struct ETHLocked {
    address parentSender;
    address childRecipient;
    uint256 amount;
  }
  // Parent layer network RDO Token -> Sent from parent layer network to child layer network
  struct ParentREDLocked  {
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
  struct ParentERC1155BatchTokenLocked {
    address tokenAddress;
    address parentSender;
    address childRecipient;
    uint256[] tokenIds;
    uint256[] amounts;
  }

  modifier onlySelf() {
    require(
      msg.sender == address(this),
      "ChildTokenMessageProcessorFacet: Only self allowed"
    );
    _;
  }

  function _getDownwardMessagePayloadType(
    DownwardMessagePayloadType payloadType
  ) internal pure returns (uint32) {
    return PAYLOAD_TYPE_START_AT + uint32(payloadType);
  }

  function _registerETHToken() internal returns (address) {
    require(
      LibToken.getBridgedERC20Token(PARENT_NATIVE_TOKEN_ADDRESS) == address(0),
      "Token already registered!"
    );

    bytes32 salt = _getSalt(address(this), PARENT_NATIVE_TOKEN_ADDRESS);
    address bridgedERC20TokenAddress = IERC20TokenFactory(address(this))
      .registerERC20Token(
        string(abi.encodePacked(BRIDGED_TOKEN_NAME_PREFIX, " ", "Ethereum")),
        string(abi.encodePacked(BRIDGED_TOKEN_SYMBOL_PREFIX, "ETH")),
        PARENT_NATIVE_TOKEN_DECIMALS,
        salt
      );

    LibToken._setBridgedERC20Token(
      PARENT_NATIVE_TOKEN_ADDRESS,
      bridgedERC20TokenAddress
    );

    return bridgedERC20TokenAddress;
  }

  function _registerERC20Token(
    address tokenAddress,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) internal returns (address) {
    require(
      LibToken.getBridgedERC20Token(tokenAddress) == address(0),
      "Token already registered!"
    );

    //IERC20Token erc20Token = IERC20Token(tokenAddress);
    bytes32 salt = _getSalt(address(this), tokenAddress);
    address bridgedERC20TokenAddress = IERC20TokenFactory(address(this))
      .registerERC20Token(
        string(abi.encodePacked(BRIDGED_TOKEN_NAME_PREFIX, " ", name)),
        string(abi.encodePacked(BRIDGED_TOKEN_SYMBOL_PREFIX, symbol)),
        decimals,
        salt
      );

    LibToken._setBridgedERC20Token(tokenAddress, bridgedERC20TokenAddress);

    return bridgedERC20TokenAddress;
  }

  function _registerERC721Token(
    address tokenAddress,
    string memory name,
    string memory symbol
  ) internal returns (address) {
    require(
      LibToken.getBridgedERC721Token(tokenAddress) == address(0),
      "Token already registered!"
    );
    bytes32 salt = _getSalt(address(this), tokenAddress);
    address bridgedERC721TokenAddress = IERC721TokenFactory(address(this))
      .registerERC721Token(
        string(abi.encodePacked(BRIDGED_TOKEN_NAME_PREFIX, " ", name)),
        string(abi.encodePacked(BRIDGED_TOKEN_SYMBOL_PREFIX, symbol)),
        salt
      );

    LibToken._setBridgedERC721Token(tokenAddress, bridgedERC721TokenAddress);

    return bridgedERC721TokenAddress;
  }

  function _registerERC1155Token(
    address tokenAddress
  ) internal returns (address) {
    require(
      LibToken.getBridgedERC1155Token(tokenAddress) == address(0),
      "Token already registered!"
    );
    bytes32 salt = _getSalt(address(this), tokenAddress);

    address bridgedERC1155TokenAddress = IERC1155TokenFactory(address(this))
      .registerERC1155Token(salt);

    LibToken._setBridgedERC1155Token(tokenAddress, bridgedERC1155TokenAddress);
    return bridgedERC1155TokenAddress;
  }

  function handleDownwardMessage(
    uint32 payloadType,
    bytes calldata payload,
    uint256 nonce
  ) external onlySelf {
    if (
      payloadType ==
      _getDownwardMessagePayloadType(DownwardMessagePayloadType.ETHLocked)
    ) {
      ETHLocked memory messagePayload = abi.decode(payload, (ETHLocked));

      address bridgedERC20Token = LibToken.getBridgedERC20Token(
        PARENT_NATIVE_TOKEN_ADDRESS
      );

      if (bridgedERC20Token == address(0)) {
        bridgedERC20Token = _registerETHToken();
      }

      IERC20Token(bridgedERC20Token).mint(
        messagePayload.childRecipient,
        messagePayload.amount
      );
    } else if (
      payloadType ==
      _getDownwardMessagePayloadType(
        DownwardMessagePayloadType.ParentERC20TokenLocked
      )
    ) {
      ParentERC20TokenLocked memory messagePayload = abi.decode(
        payload,
        (ParentERC20TokenLocked)
      );

      address bridgedERC20Token = LibToken.getBridgedERC20Token(
        messagePayload.tokenAddress
      );

      if (bridgedERC20Token == address(0)) {
        bridgedERC20Token = _registerERC20Token(
          messagePayload.tokenAddress,
          messagePayload.tokenName,
          messagePayload.tokenSymbol,
          messagePayload.decimals
        );
      }

      IERC20Token(bridgedERC20Token).mint(
        messagePayload.childRecipient,
        messagePayload.amount
      );
    } else if (
      payloadType ==
      _getDownwardMessagePayloadType(DownwardMessagePayloadType.ParentREDLocked )
    ) {
      ParentREDLocked  memory messagePayload = abi.decode(
        payload,
        (ParentREDLocked )
      );
      address tokenAddress = messagePayload.tokenAddress;
      require(
        tokenAddress == LibToken.getL1RedTokenAddress(),
        "Token address is not RDO"
      );
      //add gas limit here to avoid DDOS from malicious receiver.
      (bool success, ) = messagePayload.childRecipient.call{
        value: messagePayload.amount,
        gas: SAFE_RED_TRANSFER_GAS_LIMIT
      }("");
      require(success, "RDO transfer failed");
    } else if (
      payloadType ==
      _getDownwardMessagePayloadType(
        DownwardMessagePayloadType.ParentERC721TokenLocked
      )
    ) {
      ParentERC721TokenLocked memory messagePayload = abi.decode(
        payload,
        (ParentERC721TokenLocked)
      );

      address bridgedERC721Token = LibToken.getBridgedERC721Token(
        messagePayload.tokenAddress
      );

      if (bridgedERC721Token == address(0)) {
        bridgedERC721Token = _registerERC721Token(
          messagePayload.tokenAddress,
          messagePayload.tokenName,
          messagePayload.tokenSymbol
        );
      }

      IERC721Token(bridgedERC721Token).mint(
        messagePayload.childRecipient,
        messagePayload.tokenId
      );
    } else if (
      payloadType ==
      _getDownwardMessagePayloadType(
        DownwardMessagePayloadType.ParentERC1155BatchTokenLocked
      )
    ) {
      ParentERC1155BatchTokenLocked memory messagePayload = abi.decode(
        payload,
        (ParentERC1155BatchTokenLocked)
      );

      address bridgedERC1155Token = LibToken.getBridgedERC1155Token(
        messagePayload.tokenAddress
      );

      if (bridgedERC1155Token == address(0)) {
        bridgedERC1155Token = _registerERC1155Token(
          messagePayload.tokenAddress
        );
      }

      IERC1155Token(bridgedERC1155Token).mintBatch(
        messagePayload.childRecipient,
        messagePayload.tokenIds,
        messagePayload.amounts,
        ""
      );
    } else {
      require(false, "Invalid payload type!");
    }

    IDownwardMessageDispatcher(address(this)).relayMessage(
      payloadType,
      payload,
      nonce
    );
  }

  function _getSalt(
    address _factory,
    address _l1Token
  ) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encodePacked(_factory, keccak256(abi.encodePacked(_l1Token)))
      );
  }

  //test getSalt , should remove in production
  // function testGetSalt(
  //   address _factory,
  //   address _l1Token
  // ) public pure returns (bytes32) {
  //   return _getSalt(_factory, _l1Token);
  // }
}
