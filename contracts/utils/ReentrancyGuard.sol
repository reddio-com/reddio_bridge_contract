// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {ReentrancyGuardStorage} from "../storage/ReentrancyGuardStorage.sol";

/**
 * @title LibReentrancyGuard
 */
library LibReentrancyGuard {
  function _ensureInitialized() private {
    ReentrancyGuardStorage.ReentrancyState storage l = ReentrancyGuardStorage.layout();
    if (l.status == 0) {
      l.status = ReentrancyGuardStorage.NOT_ENTERED;
    }
  }

  function start() internal {
    _ensureInitialized();
    
    ReentrancyGuardStorage.ReentrancyState storage l = ReentrancyGuardStorage.layout();
    require(l.status != ReentrancyGuardStorage.ENTERED, "ReentrancyGuard: reentrant call");
    l.status = ReentrancyGuardStorage.ENTERED;
  }

  function end() internal {
    ReentrancyGuardStorage.ReentrancyState storage l = ReentrancyGuardStorage.layout();
    l.status = ReentrancyGuardStorage.NOT_ENTERED;
  }
  
  function status() internal view returns (uint256) {
    return ReentrancyGuardStorage.layout().status;
  }
}

/**
 * @title ReentrancyGuard
 */
contract ReentrancyGuard {
  modifier nonReentrant() {
    LibReentrancyGuard.start();
    _;
    LibReentrancyGuard.end();
  }
}