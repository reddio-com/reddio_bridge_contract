// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import "./Ownable.sol";

/**
 * @title Pausable
 */

library LibPausable {
  // event Pause();
  // event Unpause();

  bytes32 constant APP_STORAGE_PAUSABLE =
    keccak256("App.storage.Pausable");
  
  struct AppStoragePausable {
    bool paused;
  }


  function _AppStoragePausable()
    internal
    pure
    returns (AppStoragePausable storage bs)
  {
    bytes32 position = APP_STORAGE_PAUSABLE;
    assembly {
      bs.slot := position
    }
  }

  /**
   * @dev called by the owner to pause, triggers stopped state
   */
  function pause() internal {
    AppStoragePausable storage ds = _AppStoragePausable();
    ds.paused = true;
    //emit Pause();
  }

  
  /**
   * @dev called by the owner to unpause, returns to normal state
   */
  function unpause() internal {
    AppStoragePausable storage ds = _AppStoragePausable();
    ds.paused = false;
    //emit Unpause();
  }

  function pauseStatus() internal view returns (bool) {
    AppStoragePausable storage ds = _AppStoragePausable();
    return ds.paused;
  }
}

contract Pausable {
  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPaused() {
    require(!LibPausable.pauseStatus(), "AppStorage: Contract paused");
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   */
  modifier whenPaused() {
    require(LibPausable.pauseStatus());
    _;
  }
}