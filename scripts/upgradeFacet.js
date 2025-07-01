const { getSelectors, FacetCutAction } = require('./libraries/diamond.js');
const { readArtifactAbi } = require('./libraries/utils.js');
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
const axios = require('axios');
const { ETHERSCAN_KEY, HARDHAT_ENV, DIAMOND_ADDRESS } = process.env;
const chalk = require('chalk');

async function deployUpgrade(diamondAddress, facetConfig, useDeployedFacet, newFacetAddress) {
  const accounts = await ethers.getSigners();
  const wallet = facetConfig.wallet || accounts[0];
  console.log('wallet:', wallet.address);

  let balance = await ethers.provider.getBalance(wallet.address);
  balance = ethers.formatEther(balance);
  console.log("balance____", balance);

  console.log('Upgrading diamond');
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress);
  const diamondLoupe = await ethers.getContractAt('IDiamondLoupe', diamondAddress);
  const diamondCutWithWallet = diamondCut.connect(wallet);

  let facet;
  if (useDeployedFacet) {
    const facetAbi = await readArtifactAbi(facetConfig.contractName);
    facet = new ethers.Contract(newFacetAddress, facetAbi, wallet);
  } else {
    let libraries = {};
    if (facetConfig.contractName === 'ChildTokenMessageTransmitterFacet' || 
        facetConfig.contractName === 'ChildTokenMessageProcessorFacet' || 
        facetConfig.contractName === 'ChildBridgeCoreFacet') {
      if (!process.env.LIB_CHILD_LAYER_TOKEN_STORAGE) {
        throw new Error('LIB_CHILD_LAYER_TOKEN_STORAGE environment variable is not set');
      }
      console.log('Using LibChildLayerTokenStorage:', process.env.LIB_CHILD_LAYER_TOKEN_STORAGE);
      console.log('Using ReentrancyGuard:', process.env.REENTRANCY_GUARD);
      libraries = {
        LibChildLayerTokenStorage: process.env.LIB_CHILD_LAYER_TOKEN_STORAGE,
        //ReentrancyGuard: process.env.REENTRANCY_GUARD
      };
    }
    const Facet = await ethers.getContractFactory(facetConfig.contractName, { libraries });
    console.log('========= go ========');
    facet = await Facet.deploy({
      gasLimit: 4500000,
      maxFeePerGas: ((await ethers.provider.getFeeData()).gasPrice * 11n) / 10n,
    });
    console.log('facet:___________');
    await facet.deploymentTransaction().wait();
    console.log('facet:', facet.target);
  }

  const newSelectors = getSelectors(facet).filter((selector) => typeof selector === 'string');
  console.log('newSelectors:', newSelectors);
  const oldSelectors = await diamondLoupe.facetFunctionSelectors(facetConfig.oldFacetAddress);
  console.log('oldSelectors:', oldSelectors);

  const newSelectorSet = new Set(newSelectors);
  const oldSelectorSet = new Set(oldSelectors);

  const addedSelectors = newSelectors.filter((selector) => !oldSelectorSet.has(selector));
  const removedSelectors = oldSelectors.filter((selector) => !newSelectorSet.has(selector));
  const unchangedSelectors = newSelectors.filter((selector) => oldSelectorSet.has(selector));

  console.log('Added selectors:', addedSelectors);
  console.log('Removed selectors:', removedSelectors);
  console.log('Unchanged selectors:', unchangedSelectors);

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

  if (addedSelectors.length > 0) {
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
  }

  if (unchangedSelectors.length > 0) {
    const cut = [
      {
        facetAddress: facet.target,
        action: FacetCutAction.Replace,
        functionSelectors: [...unchangedSelectors],
      },
    ];
    console.log('Replacing selectors:', unchangedSelectors);
    await sendCutTransaction(cut);
  }

  if (removedSelectors.length > 0) {
    const cut = [
      {
        facetAddress: ADDRESS_ZERO,
        action: FacetCutAction.Remove,
        functionSelectors: [...removedSelectors],
      },
    ];
    console.log('Removing selectors:', removedSelectors);
    await sendCutTransaction(cut);
  }
  console.log(`==============Done=============`);
  console.log('new facet:', facet.target);
}

async function getEtherscanUrl() {
  let baseUrl;
  if (HARDHAT_ENV === 'prod' || HARDHAT_ENV === 'staging') {
    baseUrl = 'https://api.etherscan.io';
  } else if (HARDHAT_ENV === 'sepolia') {
    baseUrl = 'https://api-sepolia.etherscan.io';
  } else if (HARDHAT_ENV === 'reddio') {
    baseUrl = 'https://reddio-devnet.l2scan.co';
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

      const facetChoice = await prompt([
        {
          type: 'list',
          name: 'facetChoice',
          message: 'Select the facet to upgrade:',
          choices: [
            {
              name: 'ChildTokenMessageProcessorFacet',
              value: 'ChildTokenMessageProcessorFacet',
            },
            {
              name: 'ChildTokenMessageTransmitterFacet',
              value: 'ChildTokenMessageTransmitterFacet',
            },
            {
              name: 'ChildBridgeCoreFacet',
              value: 'ChildBridgeCoreFacet',
            },
            {
              name: 'DownwardMessageDispatcherFacet',
              value: 'DownwardMessageDispatcherFacet',
            },
            {
              name: 'ERC20TokenFactoryFacet',
              value: 'ERC20TokenFactoryFacet',
            },
            {
              name: 'ERC721TokenFactoryFacet',
              value: 'ERC721TokenFactoryFacet',
            },
            {
              name: 'ERC1155TokenFactoryFacet',
              value: 'ERC1155TokenFactoryFacet',
            },
            {
              name: 'OwnershipFacet',
              value: 'OwnershipFacet',
            },
            {
              name: 'ChildGasPriceOracleFacet',
              value: 'ChildGasPriceOracleFacet',
            },
            {
              name: 'ParentTokenMessageProcessorFacet',
              value: 'ParentTokenMessageProcessorFacet',
            },
            {
              name: 'ParentTokenMessageTransmitterFacet',
              value: 'ParentTokenMessageTransmitterFacet',
            },
            {
              name: 'ParentBridgeCoreFacet',
              value: 'ParentBridgeCoreFacet',
            },
            {
              name: 'ParentStateVerifierFacet',
              value: 'ParentStateVerifierFacet',
            },
            {
              name: 'UpwardMessageDispatcherFacet',
              value: 'UpwardMessageDispatcherFacet',
            },
            {
              name: 'TimelockFacet',
              value: 'TimelockFacet',
            }
          ],
        },
        {
          type: 'input',
          name: 'oldFacetAddress',
          message: 'Enter the oldFacetAddress:',
        },
      ]);

      const facetInfo = await getContractCreationTimeAndBlock(facetChoice.oldFacetAddress);

      console.log(
        `Facet Address: ${chalk.blue(facetChoice.oldFacetAddress)}\nDeployment Time: ${facetInfo.time}\nTransaction Hash: ${facetInfo.transactionHash}\nBlock Number: ${facetInfo.blockNumber}`,
      );

      const confirmFacetDetails = await prompt([
        {
          type: 'confirm',
          name: 'confirmFacetDetails',
          message: 'Do you confirm these details?',
        },
      ]);

      if (!confirmFacetDetails.confirmFacetDetails) {
        throw new Error('Facet details not confirmed.');
      }

      const useDeployedFacet = await prompt([
        {
          type: 'list',
          name: 'useDeployedFacet',
          message: 'Do you want to deploy a new facet contract or use an already deployed one?',
          choices: [
            {
              name: 'Deploy new facet contract',
              value: false,
            },
            {
              name: 'Use already deployed facet contract',
              value: true,
            },
          ],
        },
        {
          type: 'input',
          name: 'newFacetAddress',
          message: 'Enter the address of the already deployed new facet contract:',
          when: (answers) => answers.useDeployedFacet,
        },
      ]);

      await deployUpgrade(
        DIAMOND_ADDRESS,
        {
          contractName: facetChoice.facetChoice,
          oldFacetAddress: facetChoice.oldFacetAddress,
        },
        useDeployedFacet.useDeployedFacet,
        useDeployedFacet.newFacetAddress,
      );
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
}

exports.deployUpgrade = deployUpgrade;
