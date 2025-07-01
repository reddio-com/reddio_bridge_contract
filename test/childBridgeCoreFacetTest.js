const { expect } = require('chai');
const { deployChildLayerDiamond } = require('../scripts/deployChildLayer.js');
const { solidityPackedKeccak256 } = ethers;

describe('ChildTokenMessageProcessorFacet', function () {
  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, ethers.provider);
  let bridgeCoreWallet;
  let childTokenMessageProcessorFacet;
  let childBridgeCoreFacet;

  before(async function () {
	diamondAddress = await deployChildLayerDiamond();
    childBridgeCoreFacet = await ethers.getContractAt('ChildBridgeCoreFacet', diamondAddress);
	childTokenMessageProcessorFacet = await ethers.getContractAt('ChildTokenMessageProcessorFacet', diamondAddress);

    bridgeCoreWallet = childBridgeCoreFacet.connect(wallet);
    try {
		await network.provider.send('hardhat_setBalance', [
		  wallet.address,
		  '0x56bc75e2d63100000', // 100 ETH
		]);
	  } catch (error) {
		console.log(error);
	  }
  
	  console.log('============ChildLayer Test============');
  });

  it('should generate correct salt', async function () {
    this.skip();// To test this case, need add testGetSalt function in contracts/childLayer/tokenMessages/ChildTokenMessageProcessorFacet.sol .
    const factoryAddress = '0x0000000000000000000000000000000000000001';
    const l1TokenAddress = '0x0000000000000000000000000000000000000002';
    const encodedL1TokenAddress = solidityPackedKeccak256(['address'], [l1TokenAddress]);
    const expectedSalt = solidityPackedKeccak256(['address', 'bytes32'], [factoryAddress, encodedL1TokenAddress]);

    const salt = await childTokenMessageProcessorFacet.testGetSalt(factoryAddress, l1TokenAddress);
    
    console.log('expectedSalt:', expectedSalt);
    console.log('salt:', salt);
    expect(salt).to.equal(expectedSalt);
  });

  it('should handle ETH downward message correctly ', async function () {
    this.skip();// To test this case,  need to bypass the onlySelf modifier from contracts/childLayer/tokenMessages/ChildTokenMessageProcessorFacet.sol .
    const payloadType = 0; 
    const payload = "0x0000000000000000000000000cc0cd4a9024a2d15bbedd348fbf7cd69b5489ba0000000000000000000000000cc0cd4a9024a2d15bbedd348fbf7cd69b5489ba0000000000000000000000000000000000000000000000000000000000000064";
    const nonce = BigInt("1731312983515800048");

    const tx = await childTokenMessageProcessorFacet.handleDownwardMessage(payloadType, payload, nonce);
    await tx.wait();

    console.log('handleDownwardMessage executed successfully');
  });

  it('should handle ERC20 downward message correctly ', async function () {
    this.skip();// To test this case,  need to bypass the onlySelf modifier from contracts/childLayer/tokenMessages/ChildTokenMessageProcessorFacet.sol .
	  const payloadType = 1; 
    const payload = "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000f1e77ff9a4d4fc09cd955efc44cb843617c73f2300000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000cc0cd4a9024a2d15bbedd348fbf7cd69b5489ba0000000000000000000000000cc0cd4a9024a2d15bbedd348fbf7cd69b5489ba0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000000954455354546f6b656e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000025454000000000000000000000000000000000000000000000000000000000000";
    const nonce = BigInt("1731312983515800048");

	const tokenAddress ="0xf1e77ff9a4d4fc09cd955efc44cb843617c73f23" 
    const tx = await childTokenMessageProcessorFacet.handleDownwardMessage(payloadType, payload, nonce);
    await tx.wait();
    console.log('handleDownwardMessage executed successfully');

	const tx2 =await childBridgeCoreFacet.getBridgedERC20TokenChild(tokenAddress);
	const childTokenAddress = tx2;
    console.log('Child Token Address:', childTokenAddress);
  });

  it('should handle RED downward message correctly ', async function () {
	  const payloadType = 4; 
    const payload = "0x000000000000000000000000b878927d79975bdb288ab53271f171534a49eb7d0000000000000000000000007888b7b844b4b16c03f8dacacef7dda0f51886450000000000000000000000007888b7b844b4b16c03f8dacacef7dda0f51886450000000000000000000000000000000000000000000000000000000000000064";
    const nonce = BigInt("1731312983515800048");

	const tokenAddress ="0xf1e77ff9a4d4fc09cd955efc44cb843617c73f23" 
    const tx = await childTokenMessageProcessorFacet.handleDownwardMessage(payloadType, payload, nonce);
    await tx.wait();
    console.log('handleDownwardMessage executed successfully');

	const tx2 =await childBridgeCoreFacet.getBridgedERC20TokenChild(tokenAddress);
	const childTokenAddress = tx2;
    console.log('Child Token Address:', childTokenAddress);
  });

  it('should handle ERC721 downward message correctly ', async function () {
    this.skip();// To test this case,  need to bypass the onlySelf modifier from contracts/childLayer/tokenMessages/ChildTokenMessageProcessorFacet.sol .
    const payloadType = 2; 
      const payload = "0X00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a399aa7a6b2f4b36e36f2518fee7c2aec48dfd1000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001000000000000000000000000007bd36074b61cfe75a53e1b9df7678c96e6463b020000000000000000000000007bd36074b61cfe75a53e1b9df7678c96e6463b0200000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000007544553544e4654000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002544e000000000000000000000000000000000000000000000000000000000000";
      const nonce = BigInt("1731312983515800048");
  
    const tokenAddress ="0xa399aa7a6b2f4b36e36f2518fee7c2aec48dfd10" 
      const tx = await childTokenMessageProcessorFacet.handleDownwardMessage(payloadType, payload, nonce);
      await tx.wait();
      console.log('handleDownwardMessage executed successfully');
  
    const tx2 =await childBridgeCoreFacet.getBridgedERC721TokenChild(tokenAddress);
    const childTokenAddress = tx2;
      console.log('Child Token Address:', childTokenAddress);
    });

  it('should handle ERC1155 downward message correctly ', async function () {
    this.skip();// To test this case,  need to bypass the onlySelf modifier from contracts/childLayer/tokenMessages/ChildTokenMessageProcessorFacet.sol .
    const payloadType = 3;
    const payload = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000003713cc896e86aa63ec97088fb5894e3c985792e70000000000000000000000007888b7b844b4b16c03f8dacacef7dda0f51886450000000000000000000000007888b7b844b4b16c03f8dacacef7dda0f518864500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000c8";
    const nonce = BigInt("1731312983515800048");

  const tokenAddress ="0xa399aa7a6b2f4b36e36f2518fee7c2aec48dfd10" 
    const tx = await childTokenMessageProcessorFacet.handleDownwardMessage(payloadType, payload, nonce);
    await tx.wait();
    console.log('handleDownwardMessage executed successfully');

  const tx2 =await childBridgeCoreFacet.getBridgedERC1155TokenChild(tokenAddress);
  const childTokenAddress = tx2;
    console.log('Child Token Address:', childTokenAddress);
  });

});