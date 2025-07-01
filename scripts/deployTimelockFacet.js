async function deployTimelockFacet() {
    const TimelockFacet = await ethers.getContractFactory('TimelockFacet');
    const timelockFacet = await TimelockFacet.deploy();
    console.log('TimelockFacet hash:', timelockFacet.deploymentTransaction().hash);
    await timelockFacet.waitForDeployment();
    console.log('TimelockFacet deployed:', timelockFacet.target);
    return timelockFacet;
  }
  
  // We recommend this pattern to be able to use async/await everywhere
  // and properly handle errors.
  if (require.main === module) {
    deployTimelockFacet()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }
  
  exports.deployTimelockFacet = deployTimelockFacet;