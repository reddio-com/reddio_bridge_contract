const { getSelectors } = require('../scripts/libraries/diamond.js');

const { getERC20AssetType, readArtifactAbi } = require('../scripts/libraries/utils.js');

const { deployParentLayerDiamond } = require('../scripts/deployParentLayer.js');

// Recreate assetInfo in JavaScript

const { assert, expect } = require('chai');

describe('ParentLayerTest', async function () {
  let diamondAddress;
  let diamondCutFacet;
  let diamondLoupeFacet;
  let ownershipFacet;

  let parentLayerCore;
  let tokenMessageProcessor;
  let tokenTransmitter;
  let tokenTransmitterAbi;

  let originOwner;
  let recipient;

  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, ethers.provider);
  let accounts = [];

  before(async function () {
    diamondAddress = await deployParentLayerDiamond();
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress);

    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress);
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress);
    accounts = await ethers.getSigners();

    originOwner = accounts[0];
    recipient = accounts[1];

    bridgeCore = await ethers.getContractAt('ParentBridgeCoreFacet', diamondAddress);
    stateVerifier = await ethers.getContractAt('ParentStateVerifierFacet', diamondAddress);
    messageDispatcher = await ethers.getContractAt('UpwardMessageDispatcherFacet', diamondAddress);
    tokenMessageProcessor = await ethers.getContractAt('ParentTokenMessageProcessorFacet', diamondAddress);
    tokenTransmitter = await ethers.getContractAt('ParentTokenMessageTransmitterFacet', diamondAddress);
    tokenTransmitterAbi = await readArtifactAbi('ParentTokenMessageTransmitterFacet');

    tokenTransmitterWallet = tokenTransmitter.connect(wallet);
    tokenMessageProcessorWallet = tokenMessageProcessor.connect(wallet);

    try {
      await network.provider.send('hardhat_setBalance', [
        wallet.address,
        '0x56bc75e2d63100000', // 100 ETH
      ]);
    } catch (error) {}

    console.log('============ParentLayer Test============');
  });

  const addresses = [];

  it('should have 8 facets -- call to facetAddresses function', async () => {
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address);
    }

    assert.equal(addresses.length, 8);
  });

  it('facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
    let selectors = getSelectors(diamondCutFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0]);
    assert.sameMembers(Array.from(result), selectors);
    selectors = getSelectors(diamondLoupeFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1]);
    assert.sameMembers(Array.from(result), selectors);
    selectors = getSelectors(ownershipFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2]);
    assert.sameMembers(Array.from(result), selectors);
    selectors = getSelectors(bridgeCore);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3]);
    assert.sameMembers(Array.from(result), selectors);
    selectors = getSelectors(stateVerifier);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4]);
    assert.sameMembers(Array.from(result), selectors);
    selectors = getSelectors(messageDispatcher);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[5]);
    assert.sameMembers(Array.from(result), selectors);
    selectors = getSelectors(tokenMessageProcessor);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[6]);
    assert.sameMembers(Array.from(result), selectors);
    selectors = getSelectors(tokenTransmitter);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[7]);
    assert.sameMembers(Array.from(result), selectors);
  });

  it('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
    assert.equal(addresses[0], await diamondLoupeFacet.facetAddress('0x1f931c1c'));
    assert.equal(addresses[1], await diamondLoupeFacet.facetAddress('0xcdffacc6'));
    assert.equal(addresses[1], await diamondLoupeFacet.facetAddress('0x01ffc9a7'));
    assert.equal(addresses[2], await diamondLoupeFacet.facetAddress('0xf2fde38b'));
  });

  it('test transferOwnership', async () => {
    const tx = await ownershipFacet.transferOwnership(wallet.address);
    await tx.wait();
    assert.equal(await ownershipFacet.owner(), wallet.address);
  });

  it('test eth p -> c', async () => {
    const testAmount = ethers.parseEther('1');

    const tx = await tokenTransmitterWallet.depositETH(recipient, { value: testAmount });
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    for (const log of receipt.logs) {
      const parsedLog = bridgeCore.interface.parseLog(log);
      if (parsedLog.name === 'DownwardMessage') {
        const { payloadType, payload } = parsedLog.args;
        console.log(`payloadType=${payloadType}, payload=${payload}`);

        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['address', 'address', 'uint256'], payload);

        const parentSender = decoded[0];
        const childRecipient = decoded[1];
        const amount = decoded[2];

        console.log(
          `Decoded payload: parentSender=${parentSender},
          childRecipient=${childRecipient},
          amount=${amount.toString()}`,
        );

        assert.equal(parentSender, wallet.address);
        assert.equal(childRecipient, recipient.address);
        assert.equal(amount, testAmount);
      }
    }
  });
});
