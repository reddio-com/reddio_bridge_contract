/* global ethers */

const { getSelectors, FacetCutAction } = require('./libraries/diamond.js');

async function deployParentLayerDiamond(deployedContractsMap = {}) {
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice;
  console.log('gasPrice:', gasPrice);
  const accounts = await ethers.getSigners();
  const contractOwner = accounts[0];
  const deployGasParams = {
    gasLimit: 4200000,
    maxFeePerGas: (gasPrice * 12n) / 10n,
  };

  // deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
  let diamondCutFacet;
  if (deployedContractsMap.DiamondCutFacet) {
    diamondCutFacet = await ethers.getContractAt(DiamondCutFacet.interface, deployedContractsMap.DiamondCutFacet);
    console.log('DiamondCutFacet deployed:', diamondCutFacet.target);
  } else {
    diamondCutFacet = await DiamondCutFacet.deploy(deployGasParams);
    console.log('Transaction hash:', diamondCutFacet.deploymentTransaction().hash);
    await diamondCutFacet.waitForDeployment();
    console.log('DiamondCutFacet deployed:', diamondCutFacet.target);
  }

  // deploy Diamond
  const Diamond = await ethers.getContractFactory('Diamond');
  let diamond;
  if (deployedContractsMap.Diamond) {
    diamond = await ethers.getContractAt(Diamond.interface, deployedContractsMap.Diamond);
    console.log('Diamond deployed:', diamond.target);
  } else {
    diamond = await Diamond.deploy(contractOwner.address, diamondCutFacet.target, deployGasParams);
    await diamond.waitForDeployment();
    console.log('Diamond deployed:', diamond.target);
  }

  // deploy DiamondInit
  // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
  // Read about how the diamondCut function works here: https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
  const DiamondInit = await ethers.getContractFactory('DiamondInit');
  const diamondInit = await DiamondInit.deploy(deployGasParams);
  await diamondInit.waitForDeployment();
  console.log('DiamondInit deployed:', diamondInit.target);

  // deploy facets
  console.log('Deploying facets');
  let libParentLayerTokenStorageAddress;

  const FacetNames = [
    'DiamondLoupeFacet',
    'OwnershipFacet',
    'ParentStateVerifierFacet',
    'TimelockFacet', 
    'UpwardMessageDispatcherFacet',
    'ChildGasPriceOracleFacet',
    'LibParentLayerTokenStorage',
    'ParentBridgeCoreFacet',
    'ParentTokenMessageProcessorFacet',
    'ParentTokenMessageTransmitterFacet',
    
  ];
  const cut = [];
  for (const FacetName of FacetNames) {
    console.log('LibParentLayerTokenStorageAddress', libParentLayerTokenStorageAddress);
    let libraries = {};
    if (!!libParentLayerTokenStorageAddress) {
      libraries = {
        LibParentLayerTokenStorage: libParentLayerTokenStorageAddress,
      };
    }
    console.log('libraries:', libraries);
    const Facet = await ethers.getContractFactory(FacetName, { libraries });
    let facet;
    if (deployedContractsMap[FacetName]) {
      facet = await ethers.getContractAt(Facet.interface, deployedContractsMap[FacetName]);
    } else {
      facet = await Facet.deploy(deployGasParams);
    }
    console.log(`${FacetName} deployed: ${facet.target}`);
    if (FacetName == 'LibParentLayerTokenStorage') {
      console.log('here');
      libParentLayerTokenStorageAddress = facet.target;
    }
    cut.push({
      facetAddress: facet.target,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet),
    });
  }

  // upgrade diamond with facets
  console.log('Diamond Cut:', cut);
  console.log('Diamond Cut JSON:', JSON.stringify(cut));
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamond.target);
  let tx;
  let receipt;
  // call to init function
  let functionCall = diamondInit.interface.encodeFunctionData('init');
  tx = await diamondCut.diamondCut(cut, diamondInit.target, functionCall, { gasLimit: 5000000 });
  console.log('Diamond cut tx: ', tx.hash);
  receipt = await tx.wait();
  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`);
  }
  console.log('Completed diamond cut');
  return diamond.target;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployParentLayerDiamond()
     .then((diamondAddress) => {
      console.log(diamondAddress); 
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

exports.deployParentLayerDiamond = deployParentLayerDiamond;
