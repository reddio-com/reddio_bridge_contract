// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

interface IChildGasPriceOracleFacet {
  event L2BaseFeeUpdated(uint256 oldL2BaseFee, uint256 newL2BaseFee);
  
  /// @notice Return the latest known l2 base fee.
  function l2BaseFee() external view returns (uint256);

  /// @notice Estimate fee for cross chain message call.
  /// @param _gasLimit Gas limit required to complete the message relay on L2.
  function estimateCrossDomainMessageFee(uint32 payloadType, uint256 _gasLimit) external view returns (uint256);

  /// @notice Estimate intrinsic gas fee for cross chain message call.
  /// @param _message The message to be relayed on L2.
  function calculateIntrinsicGasFee(bytes memory _message) external view returns (uint256);
}
