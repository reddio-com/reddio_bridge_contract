const { getSelectors } = require('../scripts/libraries/diamond.js');
const { keccak256 } = require('@ethersproject/keccak256');
const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
const { toBigInt } = ethers;
const { getERC20AssetType, readArtifactAbi } = require('../scripts/libraries/utils.js');
const erc1155TokenAbi = require('../abis/ERC1155TokenAbi.js');
const { deployParentLayerDiamond } = require('../scripts/deployParentLayer.js');
const { deployERC1155Token } = require('../scripts/deployERC1155Token.js');

// Recreate assetInfo in JavaScript

const { assert, expect } = require('chai');

const usdt = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

describe('MessageQueueTest', async function () {
  let erc1155TokenAddress;
  let erc1155TokenContract;
  let erc1155TokenWallet;
  
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

  let erc1155Token;
  let erc1155TokenWithWallet;

  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, ethers.provider);
  let accounts = [];

  before(async function () {
    erc1155TokenAddress = await deployERC1155Token();
    erc1155TokenContract = await ethers.getContractAt('ERC1155Token', erc1155TokenAddress);
    erc1155TokenWallet = erc1155TokenContract.connect(wallet);

    bridgeToken = erc1155TokenContract.target;
    erc1155Token = new ethers.Contract(bridgeToken, erc1155TokenAbi, wallet);
    erc1155TokenWithWallet = erc1155Token.connect(wallet);


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

  it('test erc1155token transferOwnership', async () => {
    const tx = await erc1155TokenContract.transferOwnership(wallet.address);
    await tx.wait();
    assert.equal(await erc1155TokenContract.owner(), wallet.address);
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

  it ('test mint1155token succeed', async () => {
    const tx = await erc1155TokenWallet.mintBatch(
      wallet.address,
      [1],
      [10],
      "0x"
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    const erc1155Balance = await erc1155Token.balanceOf(wallet.address, 1);

    assert.equal(erc1155Balance, 10);
  });

  it ('test depositERC1155Token succeed', async () => {
    const testAmount = ethers.parseEther('1');
    const approveTx = await erc1155TokenWallet.setApprovalForAll(tokenTransmitterWallet.target, true);
    await approveTx.wait();
    const approveTxReceipt = await ethers.provider.getTransactionReceipt(approveTx.hash);

    const tx = await tokenTransmitterWallet.depositERC1155Token(
      erc1155TokenWallet.target,
      recipient,
      [1],
      [1],
      0,
      { value: testAmount }
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    const messageLength = await bridgeCore.nextCrossDomainMessageIndex();

    assert.equal(1, messageLength);
  });

  it('test depositERC1155Token p -> c', async () => {
    const testAmount = ethers.parseEther('1');

    const tx = await tokenTransmitterWallet.depositERC1155Token(
      erc1155TokenWallet.target,
      recipient,
      [1],
      [1],
      0,
      { value: testAmount }
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  });

  it ('test depositERC1155Token balance', async () => {
    const testAmount = toBigInt(1) * 10n ** toBigInt(18);

    const balanceBefore = await erc1155Token.balanceOf(wallet.address, 1);
    const l1BridgeBalanceBefore = await erc1155Token.balanceOf(tokenTransmitterWallet.target, 1);

    const tx = await tokenTransmitterWallet.depositERC1155Token(
      erc1155TokenWallet.target,
      recipient,
      [1],
      [1],
      0,
      { value: testAmount }
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    const balanceAfter = await erc1155Token.balanceOf(wallet.address, 1);
    const l1BridgeBalanceAfter = await erc1155Token.balanceOf(tokenTransmitterWallet.target, 1);

    //user balance
    assert.equal(balanceBefore - balanceAfter, 1);
    assert.equal(balanceAfter, 7);
    // contract balance
    assert.equal(l1BridgeBalanceAfter - l1BridgeBalanceBefore, 1);
  });

  it('test relayMessageWithProof', async () => {
    const testErc20Amount = '200';
    const testAmount = toBigInt(testErc20Amount) * 10n ** toBigInt(6);

    const balanceBefore = await erc1155Token.balanceOf(childRecipient.address, 1);
    const l1BridgeBalanceBefore = await erc1155Token.balanceOf(tokenTransmitterWallet.target, 1);

    const payload = new ethers.AbiCoder().encode([
      "address",
      "uint256[]",
      "uint256[]",
      "address",
      "address"
    ], [
      erc1155TokenContract.target,
      [1],
      [1],
      parentSender.address,
      childRecipient.address,
    ]);

    const payloadSol = await messageUpwardWallet.encodePayload(
      erc1155TokenWallet.target,
      parentSender.address,
      childRecipient.address,
      [1],
      [1]
    );

    const messages = [{
      payloadType: 3,
      payload: payloadSol,
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

    const balanceAfter = await erc1155Token.balanceOf(childRecipient.address, 1);
    const l1BridgeBalanceAfter = await erc1155Token.balanceOf(tokenTransmitterWallet.target, 1);

    //user balance
    const userBalance = balanceAfter - balanceBefore;
    assert.equal(userBalance, 1);
    // contract balance
    assert.equal(l1BridgeBalanceBefore - l1BridgeBalanceAfter, 1);

    const isL2MessageExecuted = await messageUpwardWallet.isL2MessageExecuted(messageHash);
    assert.equal(isL2MessageExecuted, true);

    const messagePayload  = await messageUpwardWallet.encodePayload(parentMessageEvent.args.payload)

    assert.equal(messagePayload[0], erc1155Token.target);
    assert.equal(messagePayload[1], parentSender.address);
    assert.equal(messagePayload[2], childRecipient.address);
    assert.equal(messagePayload[3], 1);
    assert.equal(messagePayload[4], 1);

    const hash = ethers.keccak256(new ethers.AbiCoder().encode([
      "uint32",
      "bytes",
      "uint256"
    ], [
      3,
      payloadSol,
      0,
    ]));

    assert.equal(messageHash, hash);

  });
});
