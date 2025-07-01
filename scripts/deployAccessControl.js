async function deployAccessControlFacet() {
  const AccessControlFacet = await ethers.getContractFactory('AccessControlFacet');
  const accessControlFacet = await AccessControlFacet.deploy();
  console.log('AccessControlFacet hash:', accessControlFacet.deploymentTransaction().hash);
  await accessControlFacet.waitForDeployment();
  console.log('AccessControlFacet deployed:', accessControlFacet.target);
  return accessControlFacet;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployAccessControlFacet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

exports.deployAccessControlFacet = deployAccessControlFacet;