const { getSelectors } = require('../scripts/libraries/diamond.js');
const { keccak256 } = require('@ethersproject/keccak256');
const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
const { toBigInt } = ethers;
const { getERC20AssetType, readArtifactAbi } = require('../scripts/libraries/utils.js');
const erc20TokenAbi = require('../abis/erc20TokenAbi.js');
const { deployParentLayerDiamond } = require('../scripts/deployParentLayer.js');

// Recreate assetInfo in JavaScript

const { assert, expect } = require('chai');

const usdt = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

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

  let erc20Token;
  let erc20TokenWithWallet;

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
    erc20Token = new ethers.Contract(usdt, erc20TokenAbi, wallet);

    bridgeCoreWallet = bridgeCore.connect(wallet);
    tokenTransmitterWallet = tokenTransmitter.connect(wallet);
    tokenMessageProcessorWallet = tokenMessageProcessor.connect(wallet);
    messageDispatcherWallet = messageDispatcher.connect(wallet);
    ChildGasPriceOracleWallet = ChildGasPriceOracle.connect(wallet);
    messageUpwardWallet = messageUpward.connect(wallet);

    erc20TokenWithWallet = erc20Token.connect(wallet);


    try {
      await network.provider.send('hardhat_setBalance', [
        wallet.address,
        '0x56bc75e2d63100000', // 100 ETH
      ]);
    } catch (error) {
    }


    const usdtAmount = 664 * 1000 * 1e6; // 10 USDT ==> 10000000

    const hexAmount = usdtAmount.toString(16);

    const newBalance = ethers.zeroPadValue('0x' + hexAmount, 32);

    const usdtSlot = keccak256(defaultAbiCoder.encode(['address', 'uint256'], [wallet.address, '0x2'])); // balances start in slot 2

    await network.provider.send('hardhat_setStorageAt', [usdt, usdtSlot, newBalance]);


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
    const tx = await ChildGasPriceOracleWallet.setL2BaseFee(gasTest);
    await tx.wait();

    const gas = await ChildGasPriceOracleWallet.estimateCrossDomainMessageFee(0);
    await tx.wait();

    assert.equal(gas, gasTest);
  });

  it('test #Pausable', async () => {
    const testAmount = ethers.parseEther('1');

    let tx = await bridgeCoreWallet.pauseBridge();
    await tx.wait();

    await expect(tokenTransmitterWallet.depositETH(recipient, testAmount, 0, { value: testAmount })).to.be.revertedWith(
      'AppStorage: Contract paused',
    );

    tx = await bridgeCoreWallet.unpauseBridge();
    await tx.wait();
  });

  it ('test depositErc20 succeed', async () => {
    const testAmount = ethers.parseEther('1');
    const testErc20Amount = '20000';
    const amount = toBigInt(testErc20Amount) * 10n ** toBigInt(6);

    const amountApprove = toBigInt(2000000) * 10n ** toBigInt(6);

    const approveTx = await erc20TokenWithWallet.approve(tokenTransmitterWallet.target, amountApprove);
    await approveTx.wait();
    const approveTxReceipt = await ethers.provider.getTransactionReceipt(approveTx.hash);
    
    const tx = await tokenTransmitterWallet.depositERC20Token(
      usdt,
      recipient,
      amount,
      0,
      { value: testAmount }
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    const messageLength = await bridgeCore.nextCrossDomainMessageIndex();

    assert.equal(1, messageLength);
  });

  it('test depositErc20 p -> c', async () => {
    const testAmount = ethers.parseEther('1');
    const testErc20Amount = '20000';
    const amountErc20 = toBigInt(testErc20Amount) * 10n ** toBigInt(6);

    const tx = await tokenTransmitterWallet.depositERC20Token(
      usdt,
      recipient,
      amountErc20,
      0,
      { value: testAmount }
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    for (const log of receipt.logs) {
      const parsedLog = bridgeCore.interface.parseLog(log);
      if (parsedLog?.name === 'DownwardMessage') {
        const { payloadType, payload } = parsedLog.args;
        console.log(`payloadType=${payloadType}, payload=${payload}`);

        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['address', 'address', 'address', 'uint256'], payload);

        const tokenAddress = decoded[0];
        const parentSender = decoded[1];
        const childRecipient = decoded[2];
        const amount = decoded[3];

        console.log(
          `Decoded payload: parentSender=${parentSender},
          childRecipient=${childRecipient},
          amount=${amount.toString()}`,
        );

        
        assert.equal(tokenAddress, usdt);
        assert.equal(parentSender, wallet.address);
        assert.equal(childRecipient, recipient.address);
        assert.equal(amount, amountErc20);
      }
    }
  });

  it ('test depositErc20 balance', async () => {
    const testAmount = ethers.parseEther('1');
    const testErc20Amount = '20000';
    const amount = toBigInt(testErc20Amount) * 10n ** toBigInt(6);

    const balanceBefore = await erc20Token.balanceOf(wallet.address);
    const l1BridgeBalanceBefore = await erc20Token.balanceOf(tokenTransmitterWallet.target);

    const tx = await tokenTransmitterWallet.depositERC20Token(
      usdt,
      recipient,
      amount,
      0, 
      { value: testAmount }
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    const balanceAfter = await erc20Token.balanceOf(wallet.address);
    const l1BridgeBalanceAfter = await erc20Token.balanceOf(tokenTransmitterWallet.target);

    //user balance
    assert.equal(balanceBefore - balanceAfter, amount);
    // contract balance
    assert.equal(l1BridgeBalanceAfter - l1BridgeBalanceBefore, amount);
  });

  it('test relayMessageWithProof', async () => {
    const testErc20Amount = '200';
    const testAmount = toBigInt(testErc20Amount) * 10n ** toBigInt(6);

    const balanceBefore = await erc20Token.balanceOf(childRecipient.address);
    const l1BridgeBalanceBefore = await erc20Token.balanceOf(tokenTransmitterWallet.target);

    const payload = new ethers.AbiCoder().encode([
      "address",
      "address",
      "address",
      "uint256"
    ], [
      usdt,
      parentSender.address,
      childRecipient.address,
      testAmount
    ]);

    const messages = [{
      payloadType: 1, // erc20
      payload,
      nonce: 0,
    }];
    
    const tx = await messageDispatcherWallet.receiveUpwardMessages(
      messages,
      []
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    const parentMessageEvent = messageUpwardWallet.interface.parseLog(receipt.logs[2]);
    const messageHash = parentMessageEvent.args.messageHash;

    const balanceAfter = await erc20Token.balanceOf(childRecipient.address);
    const l1BridgeBalanceAfter = await erc20Token.balanceOf(tokenTransmitterWallet.target);

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
      1,
      payload,
      0,
    ]));

    assert.equal(messageHash, hash);

    const messagePayload  = new ethers.AbiCoder().decode(
      ["address", "address", "address", "uint256"],
      parentMessageEvent.args.payload
    );

    assert.equal(messagePayload[0], usdt);
    assert.equal(messagePayload[1], parentSender.address);
    assert.equal(messagePayload[2], childRecipient.address);
    assert.equal(messagePayload[3], testAmount);
  });
});
