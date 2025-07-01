async function deployERC1155Token() {
    const gasPrice = (await ethers.provider.getFeeData()).gasPrice;
    const accounts = await ethers.getSigners();
    const contractOwner = accounts[0];
  
    const deployGasParams = {
      gasLimit: 4200000,
      maxFeePerGas: gasPrice,
    };
  
    let erc1155Token;
    const ERC1155TokenFactory = await ethers.getContractFactory('ERC1155Token');
    
    erc1155Token = await ERC1155TokenFactory.deploy(contractOwner, {...deployGasParams});
    console.log('ERC1155Token:', erc1155Token.deploymentTransaction().hash);
    await erc1155Token.waitForDeployment();
    console.log(`ERC1155Token deployed: ${erc1155Token.target}`);
    return erc1155Token;
  }
  
  // We recommend this pattern to be able to use async/await everywhere
  // and properly handle errors.
  if (require.main === module) {
    deployERC1155Token()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }
  
  exports.deployERC1155Token = deployERC1155Token;
  