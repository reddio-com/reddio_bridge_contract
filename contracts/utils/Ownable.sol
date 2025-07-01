// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import "../libraries/LibDiamond.sol";

contract Ownable {
  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
    _;
  }
}
