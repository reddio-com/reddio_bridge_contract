async function deployReentrancyGuardFacet() {
  const ReentrancyGuardFacet = await ethers.getContractFactory('ReentrancyGuard');
  const reentrancyGuardFacet = await ReentrancyGuardFacet.deploy();
  console.log('ReentrancyGuardFacet hash:', reentrancyGuardFacet.deploymentTransaction().hash);
  await reentrancyGuardFacet.waitForDeployment();
  console.log('ReentrancyGuardFacet deployed:', reentrancyGuardFacet.target);
  return reentrancyGuardFacet;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployReentrancyGuardFacet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}


exports.deployReentrancyGuardFacet = deployReentrancyGuardFacet;
  