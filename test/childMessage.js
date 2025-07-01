const { getSelectors } = require('../scripts/libraries/diamond.js');
const { getERC20AssetType, readArtifactAbi } = require('../scripts/libraries/utils.js');
const { deployChildLayerDiamond } = require('../scripts/deployChildLayer.js');

const erc20TokenAbi = require('../abis/erc20TokenAbi.js');

// Recreate assetInfo in JavaScript

const { assert, expect } = require('chai');

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const usdt = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

describe('ChildLayerTest', async function () {
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
  let erc20;
  let erc20Wallet;
  let bridgeToken

  let erc20Token;
  let erc20TokenWithWallet;

  let originOwner;
  let recipient;
  let parentSender;
  let childRecipient;

  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, ethers.provider);
  let accounts = [];

  before(async function () {
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

    //erc20 = await ethers.getContractAt('ERC20Token', diamondAddress);

    bridgeCoreWallet = bridgeCore.connect(wallet);
    messageDownwardWallet = messageDownward.connect(wallet);
    tokenTransmitterWallet = tokenTransmitter.connect(wallet);
    withdrawWallet = tokenTransmitter.connect(childRecipient);
    tokenMessageProcessorWallet = tokenMessageProcessor.connect(wallet);
    //erc20Wallet = tokenTransmitter.connect(wallet);

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
    const testAmount = ethers.parseEther('1');

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
      nonce: 0
    }];

    const tx = await messageDownwardWallet.receiveDownwardMessages(messages);
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    const childMessageEvent = messageDownwardWallet.interface.parseLog(receipt.logs[3]);
    const messageHash = childMessageEvent.args.messageHash;

    const isL1MessageExecuted = await messageDownwardWallet.isL1MessageExecuted(messageHash);

    assert.equal(isL1MessageExecuted, true);

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
  });

  it('test child mint #balance', async () => {
    const testAmount = ethers.parseEther('10');

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
      nonce: 1
    }];

    bridgeToken = await bridgeCoreWallet.getBridgedERC20TokenChild("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");

    erc20Token = new ethers.Contract(bridgeToken, erc20TokenAbi, wallet);
    erc20TokenWithWallet = erc20Token.connect(wallet);

    const balanceBefore = await erc20Token.balanceOf(childRecipient.address);

    const tx = await messageDownwardWallet.receiveDownwardMessages(messages);
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    const balanceAfter = await erc20Token.balanceOf(childRecipient.address);

    //const childMessageEvent = messageDownwardWallet.interface.parseLog(receipt.logs[3]);
    //const messageHash = childMessageEvent.args.messageHash;

    //user balance
    assert.equal(balanceAfter - balanceBefore, testAmount);
  });

  it('test child withdrawETH success', async () => {
    const testAmount = ethers.parseEther('1');
    const tx = await withdrawWallet.withdrawETH(
      childRecipient.address,
      testAmount
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  });

  it('test child withdrawETH #balance', async () => {
    const testAmount = ethers.parseEther('1');
    const balanceBefore = await erc20Token.balanceOf(childRecipient.address);

    const tx = await withdrawWallet.withdrawETH(
      childRecipient.address,
      testAmount
    );
    await tx.wait();
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

    const balanceAfter = await erc20Token.balanceOf(childRecipient.address);
    //user balance
    assert.equal(balanceBefore - balanceAfter, testAmount);
  });

  it("should allow the owner to set a new system address", async function () {
    const newSystemAddress = otherAccount.address;

    // Call setSystemAddress
    await expect(downwardMessageDispatcherFacet.connect(owner).setSystemAddress(newSystemAddress))
      .to.emit(downwardMessageDispatcherFacet, "SystemAddressUpdated")
      .withArgs(ethers.constants.AddressZero, newSystemAddress);

    // Verify the system address was updated
    const storage = await downwardMessageDispatcherFacet._dispatcherStorage();
    expect(storage.systemAddress).to.equal(newSystemAddress);
  });

  it("should revert if a non-owner tries to set the system address", async function () {
    const newSystemAddress = otherAccount.address;

    // Attempt to call setSystemAddress from a non-owner account
    await expect(
      downwardMessageDispatcherFacet.connect(otherAccount).setSystemAddress(newSystemAddress)
    ).to.be.revertedWith("LibDiamond: Must be contract owner");
  });



});
