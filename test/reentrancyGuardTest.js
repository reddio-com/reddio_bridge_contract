const { getSelectors } = require('../scripts/libraries/diamond.js');
const { assert, expect } = require('chai');
const { deployChildLayerDiamond } = require('../scripts/deployChildLayer.js');
const erc20TokenAbi = require('../abis/erc20TokenAbi.js');

describe('ReentrancyGuardTest', async function () {
  let diamondAddress;
  let bridgeCore;
  let tokenTransmitter;
  let erc20Token;
  let messageDownward;
  let messageDownwardWallet;

  let accounts;
  let owner;
  let user;
  let bridgeToken;

  const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const testAmount = ethers.parseEther('1');

  before(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];

    // Deploy contracts
    diamondAddress = await deployChildLayerDiamond();

    // Get instances of each Facet contract
    tokenTransmitter = await ethers.getContractAt('ChildTokenMessageTransmitterFacet', diamondAddress);
    bridgeCore = await ethers.getContractAt('ChildBridgeCoreFacet', diamondAddress);
    messageDownward = await ethers.getContractAt('DownwardMessageDispatcherFacet', diamondAddress);
    messageDownwardWallet = messageDownward.connect(owner);

    // Initialize
    await bridgeCore.initialize();

  });

  describe('ReentrancyGuard Tests', function () {
    let nonce = 0;
    beforeEach(async function () {
      // Prepare test environment
      await network.provider.send('hardhat_setBalance', [
        user.address,
        "0x56bc75e2d63100000"
      ]);

      // Simulate L1 message to mint tokens
      const testAmount = ethers.parseEther('10');
      const payload = new ethers.AbiCoder().encode([
        "address",
        "address",
        "uint256"
      ], [
        owner.address,
        user.address,
        testAmount
      ]);

      const messages = [{
        payloadType: 0, // eth
        payload,
        nonce: nonce++
      }];

      const tx = await messageDownwardWallet.receiveDownwardMessages(messages);
      await tx.wait();

      // Get bridgeToken and initialize erc20Token
      bridgeToken = await bridgeCore.getBridgedERC20TokenChild(ETH_ADDRESS);
      erc20Token = new ethers.Contract(bridgeToken, erc20TokenAbi, owner);
    });

    it('should allow normal ETH withdrawal', async function () {
      const testAmount = ethers.parseEther('1');
      const userTokenTransmitter = tokenTransmitter.connect(user);
      const balanceBefore = await erc20Token.balanceOf(user.address);

      await userTokenTransmitter.withdrawETH(user.address, testAmount);

      const balanceAfter = await erc20Token.balanceOf(user.address);
      expect(balanceBefore - balanceAfter).to.equal(testAmount);
    });
  });
});