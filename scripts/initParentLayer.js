const { ethers } = require("hardhat");

async function main() {
    // Config parameters
  const accounts = await ethers.getSigners();
  const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const owner = accounts[0]; 
  const contractAddress = "";
  const feeVaultAddress = ""; // TODO: Replace with actual FeeVault address
  const safeAddress = "";
  const rdoTokenAddress = ""; // TODO: Replace with actual RDO Token address
  const l2BaseFee = ethers.parseUnits("0.0000001", "ether"); // 0.0000001 ETH
//   
  // 1. Initialize ParentBridgeCoreFacet
  const bridgeCore = await ethers.getContractAt("ParentBridgeCoreFacet", contractAddress, owner);	
  const tokenTransmitter = await ethers.getContractAt("ParentTokenMessageTransmitterFacet", contractAddress, owner);
  const childGasPriceOracle = await ethers.getContractAt("ChildGasPriceOracleFacet", contractAddress, owner);
  console.log("Setting L2 base fee...");
  await (await childGasPriceOracle.setL2BaseFee(l2BaseFee)).wait();

  console.log("Setting FeeVault...");
  await (await bridgeCore.setFeeVault(feeVaultAddress)).wait();
  console.log("FeeVault set.");

  // 2. Enable ETH deposit
  console.log("Enabling ETH deposit...");
  await (await tokenTransmitter.setTokenEnabled(ethAddress, true)).wait();
  console.log("ETH deposit enabled.");

  // 3. Set ETH gas limit and base fee
  const ethPayloadType = 0; // TODO: Replace with actual ETH payloadType
  const ethMinGasLimit = 21000; // TODO: Replace with actual gas limit
  console.log("Setting ETH min gas limit...");
  await (await childGasPriceOracle.setMinGasLimitForType(ethPayloadType, ethMinGasLimit)).wait();
  console.log("ETH min gas limit set.");
  const currentFeeVault = await bridgeCore.getFeeVault();
  console.log("Current FeeVault:", currentFeeVault);
  const ethEnabled = await tokenTransmitter.isTokenEnabled(ethAddress);
  console.log("ETH enabled:", ethEnabled);
  const currentL2BaseFee = await childGasPriceOracle.getL2BaseFee();
  console.log("Current L2 base fee:", currentL2BaseFee.toString());

  // 4. Enable RDO deposit
  const rdoPayloadType = 4 // 
  const rdoMinGasLimit = 60000; // TODO: Replace with actual gas limit
  console.log("Enabling RDO deposit...");
  console.log("Setting L1 RDO token address...");
  await (await bridgeCore.setL1RedTokenAddress(rdoTokenAddress)).wait();
  console.log("L1 RDO token address set.");
  await (await tokenTransmitter.setTokenEnabled(rdoTokenAddress, true)).wait();
  console.log("RDO deposit enabled.");
  console.log("Setting RDO min gas limit...");
  await (await childGasPriceOracle.setMinGasLimitForType(rdoPayloadType, rdoMinGasLimit)).wait();
  console.log("RDO min gas limit set.");

  // 5. Initialize verifierFacet and transfer ownership
  const verifierFacet = await ethers.getContractAt("ParentStateVerifierFacet", contractAddress, owner);
  const initialAuthorities = ["","",""];
  const initialRequiredSignaturesPercentage = 100; // e.g. 3/3 multisig
  const ownershipFacet = await ethers.getContractAt("OwnershipFacet", contractAddress, owner);
  console.log("Transferring ownership to Safe...");
  await (await ownershipFacet.transferOwnership(safeAddress)).wait();  await (await verifierFacet.verifierInitialize(initialAuthorities, initialRequiredSignaturesPercentage)).wait();


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});