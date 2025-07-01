// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

abstract contract SelfCallable {
  modifier onlySelf() {
    require(msg.sender == address(this), "SelfCallable: Only self allowed");
    _;
  }
}
