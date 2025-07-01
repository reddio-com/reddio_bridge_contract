const { getSelectors, FacetCutAction } = require('./libraries/diamond.js');
const { readArtifactAbi } = require('./libraries/utils.js');
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
const axios = require('axios');
const { ETHERSCAN_KEY, HARDHAT_ENV, DIAMOND_ADDRESS } = process.env;
const chalk = require('chalk');

async function deployUpgrade(diamondAddress, newFacetAddress) {
  const accounts = await ethers.getSigners();
  const wallet = accounts[0];
  console.log('wallet:', wallet.address);

  console.log('Upgrading diamond');
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress);
  const diamondLoupe = await ethers.getContractAt('IDiamondLoupe', diamondAddress);
  const diamondCutWithWallet = diamondCut.connect(wallet);


  const facetAbi = await readArtifactAbi("TimelockFacet");
  const facet = new ethers.Contract(newFacetAddress, facetAbi, wallet);

  const newSelectors = getSelectors(facet).filter((selector) => typeof selector === 'string');
  
  const addedSelectors = newSelectors;

  console.log('Added selectors:', addedSelectors);

  const FacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2,
  };

  async function sendCutTransaction(cut) {
    const gasPrice = ((await ethers.provider.getFeeData()).gasPrice * 11n) / 10n;
    const cutGasParams = {
      gasLimit: 1000000,
      maxFeePerGas: gasPrice,
    };

    const tx = await diamondCutWithWallet.diamondCut(cut, ADDRESS_ZERO, '0x', cutGasParams);
    console.log('Transaction:', tx.hash);
  }

  
  const cut = [
    {
      facetAddress: facet.target,
      action: FacetCutAction.Add,
      functionSelectors: [...addedSelectors],
    },
  ];

  console.log('Adding selectors:', addedSelectors);
  console.log('cut:', cut);
  console.log('ADDRESS_ZERO:', ADDRESS_ZERO);

  await sendCutTransaction(cut);
  

  console.log(`==============Done=============`);
  console.log('new facet:', facet.target);
}

async function getEtherscanUrl() {
  let baseUrl;
  if (HARDHAT_ENV === 'prod' || HARDHAT_ENV === 'staging') {
    baseUrl = 'https://api.etherscan.io';
  } else if (HARDHAT_ENV === 'sepolia') {
    baseUrl = 'https://api-sepolia.etherscan.io';
  } else {
    throw new Error(`Unsupported HARDHAT_ENV: ${HARDHAT_ENV}`);
  }
  return baseUrl;
}

async function getContractCreationTimeAndBlock(address) {
  const apiKey = ETHERSCAN_KEY;
  const baseUrl = await getEtherscanUrl();
  const url = `${baseUrl}/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`;
  const response = await axios.get(url);
  const creationTx = response.data.result[0];
  return {
    time: new Date(creationTx?.timeStamp * 1000),
    blockNumber: creationTx?.blockNumber,
    transactionHash: creationTx?.hash,
  };
}

if (require.main === module) {
  (async () => {
    const inquirer = await import('inquirer');
    const { prompt } = inquirer.default;

    try {
      const diamondInfo = await getContractCreationTimeAndBlock(DIAMOND_ADDRESS);

      let environmentColor;
      switch (HARDHAT_ENV) {
        case 'prod':
          environmentColor = chalk.red(HARDHAT_ENV);
          break;
        case 'staging':
          environmentColor = chalk.yellow(HARDHAT_ENV);
          break;
        case 'sepolia':
          environmentColor = chalk.green(HARDHAT_ENV);
          break;
        default:
          environmentColor = HARDHAT_ENV;
      }

      console.log(`Deployment Environment: ${environmentColor}\n`);
      console.log(
        `Diamond Address: ${chalk.blue(DIAMOND_ADDRESS)}\nDeployment Time: ${diamondInfo.time}\nTransaction Hash: ${diamondInfo.transactionHash}\nBlock Number: ${diamondInfo.blockNumber}`,
      );

      const confirmDiamondDetails = await prompt([
        {
          type: 'confirm',
          name: 'confirmDiamondDetails',
          message: 'Do you confirm these details?',
        },
      ]);

      if (!confirmDiamondDetails.confirmDiamondDetails) {
        throw new Error('Diamond details not confirmed.');
      }

      const { newFacetAddress } = await prompt([
        {
          type: 'input',
          name: 'newFacetAddress',
          message: 'Enter the address of the already deployed new facet contract:',
        },
      ]);

      await deployUpgrade(
        DIAMOND_ADDRESS,
        newFacetAddress,
      );
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
}

exports.deployUpgrade = deployUpgrade;
