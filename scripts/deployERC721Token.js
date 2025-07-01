async function deployERC721Token(name, symbol) {
    const gasPrice = (await ethers.provider.getFeeData()).gasPrice;
    const accounts = await ethers.getSigners();
    const contractOwner = accounts[0];
  
    const deployGasParams = {
      gasLimit: 4200000,
      maxFeePerGas: gasPrice,
    };
  
    let erc721Token;
    const ERC721TokenFactory = await ethers.getContractFactory('ERC721Token');
    
    erc721Token = await ERC721TokenFactory.deploy(name, symbol, contractOwner, {...deployGasParams});
    console.log('ERC721Token:', erc721Token.deploymentTransaction().hash);
    await erc721Token.waitForDeployment();
    console.log(`ERC721Token deployed: ${erc721Token.target}`);
    return erc721Token;
  }
  
  // We recommend this pattern to be able to use async/await everywhere
  // and properly handle errors.
  if (require.main === module) {
    deployERC721Token()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }
  
  exports.deployERC721Token = deployERC721Token;
  