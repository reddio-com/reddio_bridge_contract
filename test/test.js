const { getSelectors } = require('../scripts/libraries/diamond.js');

const { getERC20AssetType, readArtifactAbi } = require('../scripts/libraries/utils.js');

const { deployParentLayerDiamond } = require('../scripts/deployParentLayer.js');
const { keccak256 } = require('@ethersproject/keccak256');
const erc20TokenAbi = require('../abis/erc20TokenAbi.js');

// Recreate assetInfo in JavaScript

const { assert, expect } = require('chai');
testAccountPk = ["","",""]

describe('ParentLayerTestAfterAudit', async function () {
	let diamondAddress;
	let diamondCutFacet;
	let diamondLoupeFacet;
	let ownershipFacet;
	let childGasPriceOracleFacet;
	let ParentStateVerifierFacet;

	let parentLayerCore;
	let tokenMessageProcessor;
	let tokenTransmitter;
	let tokenTransmitterAbi;

	let tokenTransmitterWallet;
	let tokenMessageProcessorWallet;
	let childGasPriceOracleFacetWallet;
	let rdoTokenAddress;

	let messageDispatcherWallet;

	let originOwner;
	let recipient;
	let parentSender;
    let childRecipient;
	let testUser1;
	let testUser2;
	let authorities = [];

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
		accounts.forEach((account, index) => {
			console.log(`Account ${index}: ${account.address}`);
		  });
		originOwner = accounts[0];
		recipient = accounts[1];
		parentSender = accounts[1];
		childRecipient = accounts[2]
		testUser1 = accounts[1];
		testUser2 = accounts[2];

		authorities = [accounts[0], accounts[1], accounts[2]];
	  
		bridgeCore = await ethers.getContractAt('ParentBridgeCoreFacet', diamondAddress);
		stateVerifier = await ethers.getContractAt('ParentStateVerifierFacet', diamondAddress);
		messageDispatcher = await ethers.getContractAt('UpwardMessageDispatcherFacet', diamondAddress);
		tokenMessageProcessor = await ethers.getContractAt('ParentTokenMessageProcessorFacet', diamondAddress);
		tokenTransmitter = await ethers.getContractAt('ParentTokenMessageTransmitterFacet', diamondAddress);
		tokenTransmitterAbi = await readArtifactAbi('ParentTokenMessageTransmitterFacet');
		childGasPriceOracleFacet = await ethers.getContractAt('ChildGasPriceOracleFacet', diamondAddress);
		
		LibParentLayerTokenStorage = await ethers.getContractAt('LibParentLayerTokenStorage', diamondAddress);
		
		const ERC20TokenFactory = await ethers.getContractFactory('ERC20Token');
		erc20Token = await ERC20TokenFactory.deploy("Reddio", "RDO",18, originOwner.address);
		console.log('ERC20Token:', erc20Token.deploymentTransaction().hash);
		await erc20Token.waitForDeployment();
		console.log("erc20Token Address:", erc20Token.target);
		await bridgeCore.connect(originOwner).setL1RedTokenAddress(erc20Token.target);

		await tokenTransmitter.connect(originOwner).setTokenEnabled(erc20Token.target, true);
		console.log("RDO Token deposit has been enabled.");

		const testAmount = ethers.parseEther('10000000'); 
		await erc20Token.mint(testUser1.address, testAmount);
		console.log(`Minted ${testAmount.toString()} RDO tokens to testUser1.`);
	  

		childGasPriceOracleFacetWallet = childGasPriceOracleFacet.connect(wallet);
		tokenTransmitterWallet = tokenTransmitter.connect(wallet);
		tokenMessageProcessorWallet = tokenMessageProcessor.connect(wallet);
		messageDispatcherWallet = messageDispatcher.connect(wallet);

	
		 
		
    	erc20TokenWithWallet = erc20Token.connect(wallet);


		try {
			await network.provider.send('hardhat_setBalance', [
			  wallet.address,
			  '0x56bc75e2d63100000', // 100 ETH
			]);
		  } catch (error) {}
	  
		  console.log('============ParentLayer Test============');
		});
		const addresses = [];

		it('should have 11 facets -- call to facetAddresses function', async () => {
		  for (const address of await diamondLoupeFacet.facetAddresses()) {
			console.log("Facet Address:", address); // Print the address
			addresses.push(address);
		  }
	  
		  assert.equal(addresses.length, 11);
		});

		// audit problem 1 Missing access control in the `relayMessage` and `relayMessageWithProof` functions
		it("should revert when called externally", async function () {
			const payloadType = 4;
			const address1 = "";
			const address2 = "";
			const value = 100;
			const nonce = BigInt("1733202033338462450"); 
		  
			const payload = new ethers.AbiCoder().encode(
			  ["uint32", "address", "address", "uint256", "uint256"],
			  [payloadType, address1, address2, value, nonce]
			);
		  
			console.log("Encoded Payload:", payload);
			console.log("Diamond Address:", diamondAddress);
			console.log("messageDispatcher.address;", addresses[4]);
		    const selectors = await diamondLoupeFacet.facetFunctionSelectors(addresses[4]);
			console.log("Function Selectors for upwardMessageDispatcher:", selectors);

			await expect(
			messageDispatcher.relayMessageWithProof(payloadType, payload, nonce)
			).to.be.revertedWith("UpwardMessageDispatcher: Only self allowed");
		  });
		  it('should set the L2 base fee correctly', async () => {
			const newL2BaseFee = 50 * 10 ** 9; 
		  
			console.log("Owner Address:", wallet.address);
		  
			const tx = await childGasPriceOracleFacetWallet.setL2BaseFee(newL2BaseFee);
			await tx.wait();
			console.log(`L2 Base Fee has been updated to: ${newL2BaseFee.toString()}`);
		  });
		  
		  it('should emit L2BaseFeeUpdated event', async () => {
			const oldL2BaseFee = 50 * 10 ** 9; 
			const newL2BaseFee = 100 * 10 ** 9;
		  
			await expect(childGasPriceOracleFacetWallet.setL2BaseFee(newL2BaseFee))
			  .to.emit(childGasPriceOracleFacetWallet, 'L2BaseFeeUpdated')
			  .withArgs(oldL2BaseFee, newL2BaseFee); 
		  });

			it('should set minimum gas limit for a payload type', async () => {
			const payloadType = 0; 
			const minGas = 200000; 
			
			console.log("Owner Address:", wallet.address);
			
			await childGasPriceOracleFacetWallet.setMinGasLimitForType(payloadType, minGas);
			console.log(`Set min gas limit for payloadType ${payloadType} to ${minGas}`);
			
			const payloadType4 = 4; 
			const minGas4 = 100000; 
			
			console.log("Owner Address:", wallet.address);
			
			await childGasPriceOracleFacetWallet.setMinGasLimitForType(payloadType4, minGas4);
			console.log(`Set min gas limit for payloadType ${payloadType4} to ${minGas4}`);

			});
		  it('should revert if non-owner tries to set minimum gas limit', async () => {
			const payloadType = 4; 
			const minGas = 200000; 
		  
			const nonOwnerWallet = accounts[1];
			const nonOwnerchildGasPriceOracleFacetWallet = childGasPriceOracleFacet.connect(nonOwnerWallet);
		  
			await expect(
				nonOwnerchildGasPriceOracleFacetWallet.setMinGasLimitForType(payloadType, minGas)
			).to.be.revertedWith("LibDiamond: Must be contract owner");
		  });

		  it('should set the feeVault address correctly', async () => {
			const newFeeVault = accounts[2].address; 
		  
			console.log("Owner Address:", wallet.address);
			console.log("New FeeVault Address:", newFeeVault);
		  
			await bridgeCore.setFeeVault(newFeeVault);
		  
		  });
		  it('should initialize verifier with authorities and required signatures percentage', async () => {
			const initialAuthorities = [accounts[1].address, accounts[2].address, accounts[3].address];
			const initialRequiredSignaturesPercentage = 50; // 50%
		  
			console.log("Initializing verifier...");
			await stateVerifier.verifierInitialize(initialAuthorities, initialRequiredSignaturesPercentage);
		  
			const storedAuthorities = await stateVerifier.getAuthorities();
			console.log("Stored Authorities:", storedAuthorities);
			assert.deepEqual(storedAuthorities, initialAuthorities, "Authorities were not initialized correctly");
		  
			const storedRequiredSignaturesPercentage = await stateVerifier.getRequiredSignaturesPercentage();
			console.log("Stored Required Signatures Percentage:", storedRequiredSignaturesPercentage.toString());
			assert.equal(
			  storedRequiredSignaturesPercentage.toString(),
			  initialRequiredSignaturesPercentage.toString(),
			  "Required signatures percentage was not initialized correctly"
			);
		  
		  });
	
		  it('test eth p -> c', async () => {
			const testAmount = ethers.parseEther('1');
			const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

			console.log("Token TransmitterWallet:", tokenTransmitterWallet);
			console.log("Wallet Address:", wallet.address);
			console.log("originOwner Address:", originOwner.address);
			console.log("Recipient Address:", recipient.address);
			console.log("Test Amount:", testAmount);
			feeVaultAddress = await bridgeCore.getFeeVault();
			console.log("FeeVault Address:", feeVaultAddress);
			const feeVaultStartBalance = await ethers.provider.getBalance(feeVaultAddress);
			console.log("FeeVault Start Balance:", feeVaultStartBalance, "ETH");
			const testsendAmount = ethers.parseEther('1.1'); // 1.1 ETH
			await tokenTransmitterWallet.setTokenEnabled(ethAddress,true); 
			console.log("Deposit ETH has been enabled.");
			const tx = await tokenTransmitterWallet.depositETH(recipient, testAmount , 1000000 , {
				value: testsendAmount, 
			  });
			await tx.wait();
			const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
			console.log("Transaction Receipt:", receipt.logs);
			for (const log of receipt.logs) {
			  const parsedLog = bridgeCore.interface.parseLog(log);
			  if (parsedLog.name === 'DownwardMessage') {
				const { sequence, payloadType, payload } = parsedLog.args;
				console.log(`Parsed event: sequence=${sequence}, payloadType=${payloadType}, payload=${payload}`);
		
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
	
			const feeVaultBalance = await ethers.provider.getBalance(feeVaultAddress);
			console.log("FeeVault Balance:", feeVaultBalance, "ETH");
			const finalFeeVaultBalance = feeVaultBalance - feeVaultStartBalance;
			const expectedFee = testsendAmount - testAmount; 
			assert.equal(
				finalFeeVaultBalance.toString(),
				expectedFee.toString(),
				"FeeVault balance does not match the expected value"
			);
		  });

		  it('test rdo p -> c', async () => {
			const testAmount = ethers.parseEther('1'); 
			const gasLimit = 1000000; 
		  
			console.log("Testing RDO deposit...");
		  
			const redTokenAddress = await LibParentLayerTokenStorage.getL1RedTokenAddress();
			console.log("RDO Token Address:", redTokenAddress);
		  
			await tokenTransmitterWallet.setTokenEnabled(redTokenAddress, true);
			console.log("RDO Token deposit has been enabled.");
		  
			const redToken = await ethers.getContractAt("IERC20Token", redTokenAddress);
			console.log("RDO Token Contract Address:", redToken.target);

			await redToken.mint(testUser1.address, testAmount);
			await redToken.connect(testUser1).approve(tokenTransmitterWallet.target, testAmount);
			console.log("RDO Token approved for deposit.");
			console.log("Test Amount:", testAmount.toString());
			const initialContractBalance = await redToken.balanceOf(tokenTransmitterWallet.target);
			const initialFeeVaultBalance = await ethers.provider.getBalance(feeVaultAddress);
			console.log("Initial Contract RDO Balance:", initialContractBalance.toString());
			console.log("Initial FeeVault Balance:", initialFeeVaultBalance.toString(), "ETH");
		  
			const tx = await tokenTransmitterWallet.connect(testUser1).depositRED(
			  recipient.address,
			  testAmount,
			  gasLimit,
			  { value: ethers.parseEther('0.1') } 
			);
		  
			const receipt = await tx.wait();
			console.log("Transaction Receipt:", receipt.logs);
		  
			for (const log of receipt.logs) {
			  try {
				const parsedLog = bridgeCore.interface.parseLog(log);
				if (parsedLog.name === 'DownwardMessage') {
				  const { sequence, payloadType, payload } = parsedLog.args;
				  console.log(`Parsed event: sequence=${sequence}, payloadType=${payloadType}, payload=${payload}`);
		  
				  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
					['address', 'address', 'address', 'uint256'],
					payload
				  );
		  
				  const tokenAddress = decoded[0];
				  const parentSender = decoded[1];
				  const childRecipient = decoded[2];
				  const amount = decoded[3];
		  
				  console.log(
					`Decoded payload: tokenAddress=${tokenAddress},
					parentSender=${parentSender},
					childRecipient=${childRecipient},
					amount=${amount.toString()}`,
				  );
		  
				  assert.equal(tokenAddress, redTokenAddress, "Token address mismatch");
				  assert.equal(parentSender, testUser1.address, "Parent sender mismatch");
				  assert.equal(childRecipient, recipient.address, "Child recipient mismatch");
				  assert.equal(amount.toString(), testAmount.toString(), "Amount mismatch");
				}
			  } catch (e) {
			  }
			}
		  
			const finalContractBalance = await redToken.balanceOf(tokenTransmitterWallet.target);
			const contractBalanceChange = finalContractBalance - initialContractBalance;
			console.log("Final Contract RED Balance:", finalContractBalance.toString());
			console.log("Contract RED Balance Change:", contractBalanceChange.toString());
			assert.equal(contractBalanceChange.toString(), testAmount.toString(), "Contract RED balance mismatch");
		  
			const finalFeeVaultBalance = await ethers.provider.getBalance(feeVaultAddress);
			const feeVaultBalanceChange = finalFeeVaultBalance- initialFeeVaultBalance;
			console.log("Final FeeVault Balance:", finalFeeVaultBalance.toString(), "ETH");
			console.log("FeeVault Balance Change:", feeVaultBalanceChange.toString(), "ETH");
		  });

		  it("should correctly refund the remaining value to the refund address", async function () {
			const testAmount = ethers.parseEther("1"); 
			const gasLimit = 300000; 
			const value = ethers.parseEther("1.5"); 
			const testTokenTransmitterWallet = tokenTransmitter.connect(testUser1);
			console.log("Testing refund logic...");
			console.log("Recipient Address:", testUser2.address);
			console.log("Refund Address (TestUser1):", testUser1.address);
		  
			const fee = await bridgeCore.estimateCrossMessageFee(0, gasLimit);
			console.log("Estimated Fee:", fee.toString(), "ETH");
		  
			feeVaultAddress = await bridgeCore.getFeeVault();
			console.log("FeeVault Address:", feeVaultAddress);
		  
			const initialFeeVaultBalance = await ethers.provider.getBalance(feeVaultAddress);
			const initialRefundAddressBalance = await ethers.provider.getBalance(testUser1.address);
		  
			console.log("Initial FeeVault Balance:", initialFeeVaultBalance.toString(), "WEI");
			console.log("Initial Refund Address Balance:", initialRefundAddressBalance.toString(), "WEI");
		  
			const tx = await testTokenTransmitterWallet.depositETH(
			  recipient.address,
			  testAmount,
			  gasLimit,
			  { value: value } 
			);
		  
			const receipt = await tx.wait();
			const gasUsed = receipt.gasUsed;
			const effectiveGasPrice = tx.gasPrice || receipt.effectiveGasPrice; 
			const gasCost = gasUsed * effectiveGasPrice;
			console.log("Gas Used:", gasUsed.toString());
			console.log("Effective Gas Price:", effectiveGasPrice.toString());
			console.log("Gas Cost:", gasCost.toString(), "WEI");
		  

			const finalFeeVaultBalance = await ethers.provider.getBalance(feeVaultAddress);
			const feeVaultBalanceChange = finalFeeVaultBalance - initialFeeVaultBalance;
			console.log("Final FeeVault Balance:", finalFeeVaultBalance.toString(), "WEI");
			console.log("FeeVault Balance Change:", feeVaultBalanceChange.toString(), "WEI");
			expect(feeVaultBalanceChange).to.equal(fee);
		  
			const finalRefundAddressBalance = await ethers.provider.getBalance(testUser1.address);
			const refundBalanceChange = finalRefundAddressBalance - initialRefundAddressBalance;
			const expectedRefund = value - (fee)- (testAmount); 
			console.log("Final Refund Address Balance:", finalRefundAddressBalance.toString(), "WEI");
			console.log("Refund Balance Change:", refundBalanceChange.toString(), "WEI");
			console.log("Expected Refund:", expectedRefund.toString(), "WEI");

			console.log("Gas Cost:", gasCost.toString(), "WEI");
			console.log("Refund Amount:", refundBalanceChange.toString(), "WEI");
			console.log("Expected Refund:", expectedRefund.toString(), "WEI");
			console.log("Initial Refund Address Balance:", initialRefundAddressBalance.toString(), "WEI");
			console.log("Final Refund Address Balance:", finalRefundAddressBalance.toString(), "WEI");
			
			const actualRefund = finalRefundAddressBalance -initialRefundAddressBalance  + gasCost + value
			console.log("Actual Refund:", actualRefund.toString(), "ETH");
			expect(actualRefund).to.equal(expectedRefund);
		  });

		  it("test generateValidSignatures ", async () => {
			const testMessages = [
			  {
				payloadType: 4,
				payload: "0x0000000000000000000000002655fc00139e0274dd0d84270fd80150b5f254260000000000000000000000008024117ff96bcef892f04c14ece9a0277648f9520000000000000000000000008024117ff96bcef892f04c14ece9a0277648f9520000000000000000000000000000000000000000000000000258689ac70a8000",
				nonce: Date.now()
			  }
			];
		  
			const encodedMessages = testMessages.map(m => [
			  m.payloadType,
			  m.payload,
			  m.nonce
			]);
		  
			const requiredSigners = authorities.slice(0, 3);
			const dataHash = await stateVerifier.getDataHash(encodedMessages);
			const signatures = await generateValidSignatures(dataHash);
			console.log("authorities:", authorities);
			console.log("Data Hash:", dataHash);
			console.log("Signatures:", signatures);
			const result = await stateVerifier.verifyUpwardMessages(
			  encodedMessages,
			  signatures,
			  {
				abiCoder: ethers.AbiCoder.defaultAbiCoder(),
				inputs: [
				  "tuple(uint32, bytes, uint256)[]", 
				  "bytes[]"
				]
			  }
			);
		  
			expect(result).to.be.true;
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
			console.log("Payload:", payload);
			const messages = [{
			  payloadType: 0, // eth
			  payload,
			  nonce: 0,
			}];
			const dataHash = await stateVerifier.getDataHash(messages);
		 	console.log("Data Hash:", dataHash);
			const signatures = await generateValidSignatures(dataHash);

			const tx = await messageDispatcherWallet.receiveUpwardMessages(
			  messages,
			  signatures,
			);
			await tx.wait();
			const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
			console.log("Transaction Receipt:", receipt.logs);
			const parentMessageEvent = messageDispatcherWallet.interface.parseLog(receipt.logs[1]);
			const messageHash = parentMessageEvent.args.messageHash;
		
			const balanceAfter = await ethers.provider.getBalance(childRecipient.address);
			const l1BridgeBalanceAfter = await ethers.provider.getBalance(tokenTransmitterWallet.target);
		
			//user balance
			const userBalance = balanceAfter - balanceBefore;
			console.log("balanceBefore:", balanceBefore.toString());
			console.log("balanceAfter:", balanceAfter.toString());
			console.log("User Balance:", userBalance.toString());
			assert.equal(userBalance, testAmount);
			// contract balance
			console.log("Contract Balance:", l1BridgeBalanceAfter.toString());
			assert.equal(l1BridgeBalanceBefore - l1BridgeBalanceAfter, testAmount);
		
			const isL2MessageExecuted = await messageDispatcherWallet.isL2MessageExecuted(messageHash);
			console.log("Is L2 Message Executed:", isL2MessageExecuted);
			assert.equal(isL2MessageExecuted, true);
		
			const hash = ethers.keccak256(new ethers.AbiCoder().encode([
			  "uint32",
			  "bytes",
			  "uint256"
			], [
			  0,
			  payload,
			  1,
			]));
			console.log("Hash:", hash);
		
			const messagePayload  = new ethers.AbiCoder().decode(
			  ["address", "address", "uint256"],
			  parentMessageEvent.args.payload
			);
		
			console.log("Decoded Payload:", messagePayload);
			console.log("Parent Sender Address:", messagePayload[0]);
			console.log("Child Recipient Address:", messagePayload[1]);
			console.log("Test Amount:", messagePayload[2].toString());

			assert.equal(messagePayload[0], parentSender.address);
			assert.equal(messagePayload[1], childRecipient.address);
			assert.equal(messagePayload[2], testAmount);
		  });

	});

	// async function generateUpwardMessageMultiSignatures(upwardMessages, privateKeys) {
	// 	const dataHash = await generateUpwardMessageToHash(upwardMessages);
	  
	// 	const signaturesArray = [];
	// 	for (const pk of privateKeys) {
	// 	  const wallet = new ethers.Wallet(pk); 
	// 	  const signature = await wallet.signMessage(ethers.utils.arrayify(dataHash)); 
	// 	  signaturesArray.push(signature);
	// 	}
	  
	// 	return signaturesArray;
	//   }
	  
	async function generateValidSignatures(dataHash) {
		const signatures = [];
		
		for (const signerPk of testAccountPk) {
		  const privateKey = signerPk;
		  
		  const signingKey = new ethers.SigningKey(privateKey);
		  
		  const sig = signingKey.sign(dataHash);
		  
		  const ethV = sig.v; 
	  
		  signatures.push(
			ethers.Signature.from({
			  r: sig.r,
			  s: sig.s,
			  v: ethV
			}).serialized
		  );
		}
	  
		return signatures;
	  }