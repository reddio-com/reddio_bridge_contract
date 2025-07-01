// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;
import {IERC20Token} from "../../tokens/IERC20Token.sol";

library LibAddress {
  function isContract(address account) internal view returns (bool) {
    uint256 size;
    assembly {
      size := extcodesize(account)
    }
    return size > 0;
  }

  function performEthTransfer(address recipient, uint256 amount) internal {
    (bool success, ) = recipient.call{value: amount}(""); // NOLINT: low-level-calls.
    require(success, "ETH_TRANSFER_FAILED");
  }

  /*
      Safe wrapper around ERC20/ERC721 calls.
      This is required because many deployed ERC20 contracts don't return a value.
      See https://github.com/ethereum/solidity/issues/4116.
    */
  function safeTokenContractCall(
    address tokenAddress,
    bytes memory callData
  ) internal {
    require(isContract(tokenAddress), "BAD_TOKEN_ADDRESS");
    // NOLINTNEXTLINE: low-level-calls.
    (bool success, bytes memory returndata) = tokenAddress.call(callData);
    require(success, string(returndata));

    if (returndata.length > 0) {
      require(abi.decode(returndata, (bool)), "TOKEN_OPERATION_FAILED");
    }
  }

  function safeTokenTransfer(
    address tokenAddress,
    address recipient,
    uint256 amount
  ) internal {
    IERC20Token erc20Token = IERC20Token(tokenAddress);

    bytes memory callData = abi.encodeWithSelector(
      erc20Token.transfer.selector,
      recipient,
      amount
    );

    uint256 balanceBefore = erc20Token.balanceOf(recipient);
    safeTokenContractCall(tokenAddress, callData);
    uint256 balanceAfter = erc20Token.balanceOf(recipient);

    require(
      balanceAfter == balanceBefore + amount,
      "SAFE_TOKEN_TRANSFER_FAILED"
    );
  }

  function safeTokenTransferFrom(
    address tokenAddress,
    address sender,
    address recipient,
    uint256 amount
  ) internal {
    IERC20Token erc20Token = IERC20Token(tokenAddress);

    bytes memory callData = abi.encodeWithSelector(
      erc20Token.transferFrom.selector,
      sender,
      recipient,
      amount
    );

    uint256 balanceBefore = erc20Token.balanceOf(recipient);
    safeTokenContractCall(tokenAddress, callData);
    uint256 balanceAfter = erc20Token.balanceOf(recipient);

    require(
      balanceAfter == balanceBefore + amount,
      "SAFE_TOKEN_TRANSFER_FAILED"
    );
  }

  /*
      Validates that the passed contract address is of a real contract,
      and that its id hash (as infered fromn identify()) matched the expected one.
    */
  function validateContractId(
    address contractAddress,
    bytes32 expectedIdHash
  ) internal {
    require(isContract(contractAddress), "ADDRESS_NOT_CONTRACT");
    (bool success, bytes memory returndata) = contractAddress.call( // NOLINT: low-level-calls.
        abi.encodeWithSignature("identify()")
      );
    require(success, "FAILED_TO_IDENTIFY_CONTRACT");
    string memory realContractId = abi.decode(returndata, (string));
    require(
      keccak256(abi.encodePacked(realContractId)) == expectedIdHash,
      "UNEXPECTED_CONTRACT_IDENTIFIER"
    );
  }
}
