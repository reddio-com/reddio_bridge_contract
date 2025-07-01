const { ethers } = require("hardhat");

async function main() {
  // Config parameters
  const accounts = await ethers.getSigners();
  const owner = accounts[0]; // Use the first account as owner by default
  const contractAddress = "0xeC054c6ee2DbbeBC9EbCA50CdBF94A94B02B2E40";  // TODO: Replace with actual ChildLayer contract address
  const safeAddress = "0x7Bd36074b61Cfe75a53e1B9DF7678C96E6463b02"; // TODO: Replace with actual Safe address
  const rdoTokenAddress = "0xB878927d79975BDb288ab53271f171534A49eb7D"; // TODO: Replace with actual RDO Token address
  const systemAddress = "0x0CC0cD4A9024A2d15BbEdd348Fbf7Cd69B5489bA"; // TODO: Replace with actual system address
  const rdoAmount = ethers.parseUnits("1000000", 18); // TODO: Replace with actual transfer amount

  // 1. Set system address
  const downwardDispatcher = await ethers.getContractAt("DownwardMessageDispatcherFacet", contractAddress, owner);
  console.log("Setting system address...");
  await (await downwardDispatcher.setSystemAddress(systemAddress)).wait();
  console.log("System address set.");
  const ethgasAmount = ethers.parseEther("10")
  console.log("Transferring RDO for gasfee to systemAddress...");
  const tx = await owner.sendTransaction({
    to: systemAddress,
    value: ethgasAmount,
  });


  // 2. Initialize RDO cross-chain functionality
  // 2.1 Transfer RDO (native token) to the bridge contract as distribution funds
  console.log("Transferring RDO (native token) to bridge contract...");
  const tx2 = await owner.sendTransaction({
    to: contractAddress,
    value: rdoAmount,
  });
  await tx2.wait();
  console.log("RDO transferred to bridge contract.");

  // 2.2 Set RDO Token address
  const childBridgeCore = await ethers.getContractAt("ChildBridgeCoreFacet", contractAddress, owner);
  console.log("Setting RedToken address...");
  await (await childBridgeCore.setRedTokenAddress(rdoTokenAddress)).wait();
  console.log("RedToken address set.");

  // 3. Transfer contract ownership to Safe address
  const ownershipFacet = await ethers.getContractAt("OwnershipFacet", contractAddress, owner);
  console.log("Transferring ownership to Safe...");
  await (await ownershipFacet.transferOwnership(safeAddress)).wait();
  console.log("Ownership transferred to Safe.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});