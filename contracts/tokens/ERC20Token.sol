// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ERC20Token is ERC20, Ownable {
  uint8 private _decimals;

  constructor(
    string memory name,
    string memory symbol,
    uint8 initDecimals,
    address creator
  ) ERC20(name, symbol) Ownable(creator) {
    _decimals = initDecimals;
  }

  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) external onlyOwner {
    _burn(from, amount);
  }

  function setDecimals(uint8 initDecimals) external onlyOwner {
    _decimals = initDecimals;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }
}
