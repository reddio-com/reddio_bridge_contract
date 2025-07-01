// SPDX-License-Identifier: Apache-2.0.
pragma solidity ^0.8.24;

import {Ownable} from "../../utils/Ownable.sol";
import "hardhat/console.sol";

contract ChildGasPriceOracleFacet is Ownable  {
  bytes32 constant CHILD_GAS_PRICE_ORACLE_STORAGE =
    keccak256("child.gas.price.oracle.storage");

  event L2BaseFeeUpdated(uint256 oldL2BaseFee, uint256 newL2BaseFee);

  /// @notice Emitted when intrinsic params are updated.
  /// @param txGas The intrinsic gas for transaction.
  /// @param txGasContractCreation The intrinsic gas for contract creation.
  /// @param zeroGas The intrinsic gas for each zero byte.
  /// @param nonZeroGas The intrinsic gas for each nonzero byte.
  event IntrinsicParamsUpdated(uint256 txGas, uint256 txGasContractCreation, uint256 zeroGas, uint256 nonZeroGas);

  struct IntrinsicParams {
    // The intrinsic gas for transaction.
    uint64 txGas;
    // The intrinsic gas for contract creation. It is reserved for future use.
    uint64 txGasContractCreation;
    // The intrinsic gas for each zero byte.
    uint64 zeroGas;
    // The intrinsic gas for each nonzero byte.
    uint64 nonZeroGas;
  }

  struct GasPriceOracleStorage {
    /// @notice The intrinsic params for transaction.
    IntrinsicParams intrinsicParams;
    /// @notice The latest known l2 base fee.
    uint256 l2BaseFee;

    mapping(uint32 => uint256) minGasLimitPerType;

  }

  function _gasPriceOracleStorage()
    internal
    pure
    returns (GasPriceOracleStorage storage bs)
  {
    bytes32 position = CHILD_GAS_PRICE_ORACLE_STORAGE;
    assembly {
      bs.slot := position
    }
  }

  /*************************
    * Public View Functions *
  *************************/

  function calculateIntrinsicGasFee(bytes memory _message) external view returns (uint256) {
    GasPriceOracleStorage storage ds = _gasPriceOracleStorage();

    uint256 _txGas = uint256(ds.intrinsicParams.txGas);
    uint256 _zeroGas = uint256(ds.intrinsicParams.zeroGas);
    uint256 _nonZeroGas = uint256(ds.intrinsicParams.nonZeroGas);

    uint256 gas = _txGas;
    if (_message.length > 0) {
      uint256 nz = 0;
      for (uint256 i = 0; i < _message.length; i++) {
        if (_message[i] != 0) {
          nz++;
        }
      }
      gas += nz * _nonZeroGas + (_message.length - nz) * _zeroGas;
    }
    return uint256(gas);
  }


  function estimateCrossDomainMessageFee(uint32 payloadType,uint256 _gasLimit) external view returns (uint256) {
    GasPriceOracleStorage storage ds = _gasPriceOracleStorage();
    uint256 minGasLimit = ds.minGasLimitPerType[payloadType];
    require(minGasLimit > 0, "Payload type is not configured");
    require(_gasLimit >= minGasLimit, "Gas limit is below the minimum required for this payload type");
    return _gasLimit * ds.l2BaseFee;
  }

  function getMinGasLimit(uint32 messageType) external view returns (uint256) {
      GasPriceOracleStorage storage ds = _gasPriceOracleStorage();
      return ds.minGasLimitPerType[messageType];
  }

  function getL2BaseFee() external view returns (uint256) {
    GasPriceOracleStorage storage ds = _gasPriceOracleStorage();
    return ds.l2BaseFee;
  }

  /*****************************
    * Public Mutating Functions *
  *****************************/

  /// @notice Allows whitelisted caller to modify the l2 base fee.
  /// @param _newL2BaseFee The new l2 base fee.
  function setL2BaseFee(uint256 _newL2BaseFee) onlyOwner external {
    GasPriceOracleStorage storage ds = _gasPriceOracleStorage();

    uint256 _oldL2BaseFee = ds.l2BaseFee;
    ds.l2BaseFee = _newL2BaseFee;

    emit L2BaseFeeUpdated(_oldL2BaseFee, _newL2BaseFee);
  }

  /// @notice Allows the owner to set the minimum gas limit for a specific payload type.
  function setMinGasLimitForType(uint32 payloadType, uint256 minGas) external onlyOwner {
    GasPriceOracleStorage storage ds = _gasPriceOracleStorage();
    ds.minGasLimitPerType[payloadType] = minGas;
  }

  /************************
    * Restricted Functions *
  ************************/

  /// @notice Allows the owner to update parameters for intrinsic gas calculation.
  /// @param _txGas The intrinsic gas for transaction.
  /// @param _txGasContractCreation The intrinsic gas for contract creation.
  /// @param _zeroGas The intrinsic gas for each zero byte.
  /// @param _nonZeroGas The intrinsic gas for each nonzero byte.
  function setIntrinsicParams(
    uint64 _txGas,
    uint64 _txGasContractCreation,
    uint64 _zeroGas,
    uint64 _nonZeroGas
  ) external onlyOwner {
    _setIntrinsicParams(_txGas, _txGasContractCreation, _zeroGas, _nonZeroGas);
  }

  /**********************
    * Internal Functions *
  **********************/

  /// @dev Internal function to update parameters for intrinsic gas calculation.
  /// @param _txGas The intrinsic gas for transaction.
  /// @param _txGasContractCreation The intrinsic gas for contract creation.
  /// @param _zeroGas The intrinsic gas for each zero byte.
  /// @param _nonZeroGas The intrinsic gas for each nonzero byte.
  function _setIntrinsicParams(
    uint64 _txGas,
    uint64 _txGasContractCreation,
    uint64 _zeroGas,
    uint64 _nonZeroGas
  ) internal {
    require(_txGas > 0, "txGas is zero");
    require(_zeroGas > 0, "zeroGas is zero");
    require(_nonZeroGas > 0, "nonZeroGas is zero");
    require(_txGasContractCreation > _txGas, "txGasContractCreation is less than txGas");

    GasPriceOracleStorage storage ds = _gasPriceOracleStorage();

    ds.intrinsicParams = IntrinsicParams({
      txGas: _txGas,
      txGasContractCreation: _txGasContractCreation,
      zeroGas: _zeroGas,
      nonZeroGas: _nonZeroGas
    });

    emit IntrinsicParamsUpdated(_txGas, _txGasContractCreation, _zeroGas, _nonZeroGas);
  }
}
