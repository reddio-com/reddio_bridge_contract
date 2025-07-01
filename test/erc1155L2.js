const { getSelectors } = require('../scripts/libraries/diamond.js');
const { geterc1155AssetType, readArtifactAbi } = require('../scripts/libraries/utils.js');
const { deployChildLayerDiamond } = require('../scripts/deployChildLayer.js');
const { deployERC1155Token } = require('../scripts/deployERC1155Token.js');

const erc1155TokenAbi = require('../abis/ERC1155TokenAbi.js');

// Recreate assetInfo in JavaScript

const { assert, expect } = require('chai');

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const usdt = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

describe('ChildLayerTest', async function () {
  let erc1155TokenAddress;
  let erc1155TokenContract;
  let erc1155TokenWallet;

  let diamondAddress;
  let diamondCutFacet;
  let diamondLoupeFacet;
  let ownershipFacet;

  let bridgeCoreWallet;
  let tokenMessageProcessor;
  let tokenTransmitter;
  let tokenTransmitterAbi;
  let messageDownward;
  let messageDownwardWallet;
  let withdrawWallet;
  let erc1155;
  let erc1155Wallet;
  let bridgeToken

  let erc1155Token;
  let erc1155TokenWithWallet;

  let originOwner;
  let recipient;
  let parentSender;
  let childRecipient;

  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, ethers.provider);
  let accounts = [];

  before(async function () {
    erc1155TokenAddress = await deployERC1155Token();
    erc1155TokenContract = await ethers.getContractAt('ERC1155Token', erc1155TokenAddress);
    erc1155TokenWallet = erc1155TokenContract.connect(wallet);


    diamondAddress = await deployChildLayerDiamond();
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress);

    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress);
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress);
    accounts = await ethers.getSigners();

    originOwner = accounts[0];
    recipient = accounts[1];

    parentSender = accounts[2];
    childRecipient = accounts[3];

    bridgeCore = await ethers.getContractAt('ChildBridgeCoreFacet', diamondAddress);
    stateVerifier = await ethers.getContractAt('ParentStateVerifierFacet', diamondAddress);
    messageDownward = await ethers.getContractAt('DownwardMessageDispatcherFacet', diamondAddress);
    tokenMessageProcessor = await ethers.getContractAt('ChildTokenMessageProcessorFacet', diamondAddress);
    tokenTransmitter = await ethers.getContractAt('ChildTokenMessageTransmitterFacet', diamondAddress);
    tokenTransmitterAbi = await readArtifactAbi('ChildTokenMessageTransmitterFacet');

    //erc1155 = await ethers.getContractAt('erc1155Token', diamondAddress);

    bridgeCoreWallet = bridgeCore.connect(wallet);
    messageDownwardWallet = messageDownward.connect(wallet);
    tokenTransmitterWallet = tokenTransmitter.connect(wallet);
    withdrawWallet = tokenTransmitter.connect(childRecipient);
    tokenMessageProcessorWallet = tokenMessageProcessor.connect(wallet);
    //erc1155Wallet = tokenTransmitter.connect(wallet);

    try {
      await network.provider.send('hardhat_setBalance', [
        wallet.address,
        '0x56bc75e2d63100000', // 100 ETH
      ]);
    } catch (error) {}

    console.log('============ChildLayer Test============');
  });

  it('test transferOwnership', async () => {
    const tx = await ownershipFacet.transferOwnership(wallet.address);
    await tx.wait();
    assert.equal(await ownershipFacet.owner(), wallet.address);
  });

  it('test initialize', async () => {
    const tx = await bridgeCore.initialize();
    await tx.wait();
  });


  it('test child mint success', async () => {
    const payloadType = 3;

    const payloadSol = await tokenMessageProcessorWallet.encodePayload(
      erc1155TokenWallet.target,
      parentSender.address,
      childRecipient.address,
      [1],
      [1]
    );

    const messages = [{
      payloadType,
      payload: payloadSol,
      nonce: 0
    }];

    const tx = await messageDownwardWallet.receiveDownwardMessages(messages);
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    const childMessageEvent = messageDownwardWallet.interface.parseLog(receipt.logs[4]);
    const messageHash = childMessageEvent.args.messageHash;

    const isL1MessageExecuted = await messageDownwardWallet.isL1MessageExecuted(messageHash);

    let balanceAfter = 0;

    bridgeToken = await bridgeCoreWallet.getBridgedERC1155TokenChild(erc1155TokenWallet.target);
    erc1155Token = new ethers.Contract(bridgeToken, erc1155TokenAbi, wallet);
    erc1155TokenWithWallet = erc1155Token.connect(wallet);


    try {
      balanceAfter = await erc1155Token.balanceOf(childRecipient.address, 1);
    } catch (error) {
    }

    assert.equal(isL1MessageExecuted, true);

    const hash = ethers.keccak256(new ethers.AbiCoder().encode([
      "uint32",
      "bytes",
      "uint256"
    ], [
      payloadType,
      payloadSol,
      0,
    ]));
    console.log("balanceAfter_____", balanceAfter);

    assert.equal(messageHash, hash);
  });

  it('test child mint #balance', async () => {
    const payloadType = 3;

    const payloadSol = await tokenMessageProcessorWallet.encodePayload(
      erc1155TokenWallet.target,
      parentSender.address,
      childRecipient.address,
      [2],
      [2]
    );

    const messages = [{
      payloadType,
      payload: payloadSol,
      nonce: 1
    }];

    const balanceBefore = await erc1155Token.balanceOf(childRecipient.address, 2);

    const tx = await messageDownwardWallet.receiveDownwardMessages(messages);
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    
    const balanceAfter = await erc1155Token.balanceOf(childRecipient.address, 2);

    //const childMessageEvent = messageDownwardWallet.interface.parseLog(receipt.logs[3]);
    //const messageHash = childMessageEvent.args.messageHash;

    //user balance
    console.log("balanceAfter___", balanceAfter, balanceBefore);
    assert.equal(balanceAfter - balanceBefore, 2);
  });

  it('test child withdrawErc1155BatchToken success', async () => {
    const balanceBefore = await erc1155Token.balanceOf(childRecipient.address, 2);
    const tx = await withdrawWallet.withdrawErc1155BatchToken(
    erc1155TokenWallet.target,
    childRecipient.address,
    [2],
    [1]
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    const balanceAfter = await erc1155Token.balanceOf(childRecipient.address, 2);
    assert.equal(balanceBefore - balanceAfter, 1);
  });
});
