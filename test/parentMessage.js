const { getSelectors } = require('../scripts/libraries/diamond.js');

const { getERC20AssetType, readArtifactAbi } = require('../scripts/libraries/utils.js');

const { deployParentLayerDiamond } = require('../scripts/deployParentLayer.js');

// Recreate assetInfo in JavaScript

const { assert, expect } = require('chai');

describe('MessageQueueTest', async function () {
  let diamondAddress;
  let diamondCutFacet;
  let diamondLoupeFacet;
  let ownershipFacet;

  let parentLayerCore;
  let tokenMessageProcessor;
  let tokenTransmitter;
  let tokenTransmitterAbi;
  let messageDispatcherWallet;
  let ChildGasPriceOracle;
  let ChildGasPriceOracleWallet;
  let messageUpward;
  let messageUpwardWallet;
  let bridgeCoreWallet;

  let originOwner;
  let recipient;
  let parentSender;
  let childRecipient;

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

    parentSender = accounts[2];
    childRecipient = accounts[3];

    bridgeCore = await ethers.getContractAt('ParentBridgeCoreFacet', diamondAddress);
    stateVerifier = await ethers.getContractAt('ParentStateVerifierFacet', diamondAddress);
    messageDispatcher = await ethers.getContractAt('UpwardMessageDispatcherFacet', diamondAddress);
    tokenMessageProcessor = await ethers.getContractAt('ParentTokenMessageProcessorFacet', diamondAddress);
    tokenTransmitter = await ethers.getContractAt('ParentTokenMessageTransmitterFacet', diamondAddress);
    tokenTransmitterAbi = await readArtifactAbi('ParentTokenMessageTransmitterFacet');
    ChildGasPriceOracle = await ethers.getContractAt('ChildGasPriceOracleFacet', diamondAddress);
    messageUpward = await ethers.getContractAt('UpwardMessageDispatcherFacet', diamondAddress);

    bridgeCoreWallet = bridgeCore.connect(wallet);
    tokenTransmitterWallet = tokenTransmitter.connect(wallet);
    tokenMessageProcessorWallet = tokenMessageProcessor.connect(wallet);
    messageDispatcherWallet = messageDispatcher.connect(wallet);
    ChildGasPriceOracleWallet = ChildGasPriceOracle.connect(wallet);
    messageUpwardWallet = messageUpward.connect(wallet);

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

    assert.equal(addresses.length, 9);
  });


  it('test transferOwnership', async () => {
    const tx = await ownershipFacet.transferOwnership(wallet.address);
    await tx.wait();
    assert.equal(await ownershipFacet.owner(), wallet.address);
  });

  it('test #setL2BaseFee', async () => {
    const gasTest = 0;
    const balanceBefore = await ethers.provider.getBalance(wallet.address);

    const tx = await ChildGasPriceOracleWallet.setL2BaseFee(gasTest);
    await tx.wait();

    const gas = await ChildGasPriceOracleWallet.estimateCrossDomainMessageFee(0);
    await tx.wait();

    assert.equal(gas, gasTest);
  });

  it('test #Pausable', async () => {
    const testAmount = ethers.parseEther('1');
    const balanceBefore = await ethers.provider.getBalance(wallet.address);

    let tx = await bridgeCoreWallet.pauseBridge();
    await tx.wait();

    await expect(tokenTransmitterWallet.depositETH(recipient, testAmount, 0, { value: testAmount })).to.be.revertedWith(
      'AppStorage: Contract paused',
    );

    tx = await bridgeCoreWallet.unpauseBridge();
    await tx.wait();
  });

  it ('test depositETH succeed', async () => {
    const testAmount = ethers.parseEther('1');
    const tx = await tokenTransmitterWallet.depositETH(recipient, testAmount, 0, { value: testAmount });
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    const messageLength = await bridgeCore.nextCrossDomainMessageIndex();

    assert.equal(1, messageLength);
  });

  it('test eth p -> c', async () => {
    const testAmount = ethers.parseEther('1');

    const tx = await tokenTransmitterWallet.depositETH(recipient, testAmount, 0, { value: testAmount });
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

  it ('test depositETH balance', async () => {
    const testAmount = ethers.parseEther('1');
    const balanceBefore = await ethers.provider.getBalance(wallet.address);
    const l1BridgeBalanceBefore = await ethers.provider.getBalance(tokenTransmitterWallet.target);

    const tx = await tokenTransmitterWallet.depositETH(recipient, testAmount, 0, { value: testAmount });
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    
    const gasFee = receipt.gasUsed * receipt.gasPrice;

    const balanceAfter = await ethers.provider.getBalance(wallet.address);
    const l1BridgeBalanceAfter = await ethers.provider.getBalance(tokenTransmitterWallet.target);

    //user balance
    assert.equal(balanceBefore - balanceAfter - gasFee, testAmount);
    // contract balance
    assert.equal(l1BridgeBalanceAfter - l1BridgeBalanceBefore, testAmount);
  });

  it('test relayMessageWithProof', async () => {
    const testAmount = ethers.parseEther('1');

    const balanceBefore = await ethers.provider.getBalance(childRecipient.address);
    const l1BridgeBalanceBefore = await ethers.provider.getBalance(tokenTransmitterWallet.target);

    const payload = new ethers.AbiCoder().encode([
      "address",
      "address",
      "uint256"
    ], [
      parentSender.address,
      childRecipient.address,
      testAmount
    ]);

    const messages = [{
      payloadType: 0, // eth
      payload,
      nonce: 0,
    }];
    
    const tx = await messageDispatcherWallet.receiveUpwardMessages(
      messages,
      []
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    const parentMessageEvent = messageUpwardWallet.interface.parseLog(receipt.logs[1]);
    const messageHash = parentMessageEvent.args.messageHash;

    const balanceAfter = await ethers.provider.getBalance(childRecipient.address);
    const l1BridgeBalanceAfter = await ethers.provider.getBalance(tokenTransmitterWallet.target);

    //user balance
    const userBalance = balanceAfter - balanceBefore;
    assert.equal(userBalance, testAmount);
    // contract balance
    assert.equal(l1BridgeBalanceBefore - l1BridgeBalanceAfter, testAmount);

    const isL2MessageExecuted = await messageUpwardWallet.isL2MessageExecuted(messageHash);
    assert.equal(isL2MessageExecuted, true);

    const hash = ethers.keccak256(new ethers.AbiCoder().encode([
      "uint32",
      "bytes",
      "uint256"
    ], [
      0,
      payload,
      0,
    ]));

    assert.equal(messageHash, hash);

    const messagePayload  = new ethers.AbiCoder().decode(
      ["address", "address", "uint256"],
      parentMessageEvent.args.payload
    );

    assert.equal(messagePayload[0], parentSender.address);
    assert.equal(messagePayload[1], childRecipient.address);
    assert.equal(messagePayload[2], testAmount);
  });
});
