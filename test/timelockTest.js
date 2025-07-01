const { getSelectors } = require('../scripts/libraries/diamond.js');
const { assert, expect } = require('chai');
const { deployParentLayerDiamond } = require('../scripts/deployParentLayer.js');
const { ethers } = require('hardhat');
const crypto = require('crypto');
const { FacetCutAction } = require("../scripts/libraries/diamond.js");

describe('TimelockTest', async function () {
  const INITIAL_DELAY = 86400;
  const NEW_DELAY = 172800;
  const TEST_DELAY = 10;

  const OperationState = {
    Unset: 0,
    Pending: 1,
    Ready: 2,
    Done: 3,
    Cancelled: 4
  };

  const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes('EMERGENCY_ROLE'));

  let contracts;
  let accounts;

  async function setupContracts() {
    const diamondAddress = await deployParentLayerDiamond();
    
    const diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress);
    const diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress);
    const ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress);

    const AccessControlFactory = await ethers.getContractFactory("AccessControlFacet");
    const accessControlFacetInstance = await AccessControlFactory.deploy();
    await accessControlFacetInstance.waitForDeployment();

    const accessControlFacetContract = await ethers.getContractAt("AccessControlFacet", accessControlFacetInstance.target);
    
    const cutAccess = [{
      facetAddress: accessControlFacetInstance.target,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(accessControlFacetContract)
    }];

    await diamondCutFacet.diamondCut(cutAccess, ethers.ZeroAddress, "0x");

    const accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);

    const timelockFactory = await ethers.getContractFactory("TimelockFacet");
    const timelockFacetInstance = await timelockFactory.deploy();
    await timelockFacetInstance.waitForDeployment();

    const timelockContract = await ethers.getContractAt("TimelockFacet", timelockFacetInstance.target);

    const cut = [{
      facetAddress: timelockFacetInstance.target,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(timelockContract)
    }];

    await diamondCutFacet.diamondCut(cut, ethers.ZeroAddress, "0x");

    const timelockFacet = await ethers.getContractAt('TimelockFacet', diamondAddress);

    return {
      diamondAddress,
      diamondCutFacet,
      diamondLoupeFacet,
      ownershipFacet,
      accessControlFacet,
      timelockFacet
    };
  }

  async function setupAccounts() {
    const allAccounts = await ethers.getSigners();
    return {
      owner: allAccounts[0],
      admin: allAccounts[1],
      emergency: allAccounts[2],
      user: allAccounts[3]
    };
  }

  before(async function () {
    contracts = await setupContracts();
    accounts = await setupAccounts();

    try {
      await contracts.accessControlFacet.initializeAccessControl();
      await contracts.accessControlFacet.grantRole(EMERGENCY_ROLE, accounts.emergency.address);
      
      console.log('AccessControl initialized');
    } catch (error) {
      console.log('AccessControl already initialized or error:', error.message);
    }


    console.log('============Timelock Test============');
  });

  describe('Initialization', function () {
    describe('Timelock Setup', function () {
      it('should initialize timelock with initial delay', async function () {
        await contracts.timelockFacet.initializeTimelock(INITIAL_DELAY);
        
        const target = contracts.diamondAddress;
        const value = 0;
        const data = '0x';
        const predecessor = ethers.ZeroHash;
        
        const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
        let operationId = await timelockFacetAdmin.schedule(target, value, data, predecessor, INITIAL_DELAY,  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
        const receipt = await operationId.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
        operationId = event.args.operationId;

        const state = await contracts.timelockFacet.getOperationState(operationId);
        assert.equal(state, OperationState.Pending, 'Operation should be in Pending state');
      });

      it('should update delay time', async function () {
        const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
        await timelockFacetAdmin.updateDelay(NEW_DELAY);
        
        const target = contracts.diamondAddress;
        const value = 0;
        const data = '0x12345678';
        const predecessor = ethers.ZeroHash;
        const salt = ethers.randomBytes(32);
        
        const tx = await timelockFacetAdmin.schedule(target, value, data, predecessor, NEW_DELAY, salt);
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
        const operationId = event.args.operationId;
        
        const state = await contracts.timelockFacet.getOperationState(operationId);
        assert.equal(state, OperationState.Pending, 'Operation should be in Pending state');
      });
    });
  });

  describe('Operation Management', function () {
    describe('Basic Operations', function () {
      let operationId;
      let target;
      let value;
      let data;
      let predecessor;
      
      beforeEach(async function () {
        target = contracts.diamondAddress;
        value = 0;

        data = contracts.diamondLoupeFacet.interface.encodeFunctionData('facetAddresses', []);
        predecessor = ethers.ZeroHash;
        const salt = ethers.randomBytes(32);
        
        const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
        await timelockFacetAdmin.updateDelay(TEST_DELAY);
        
        const tx = await timelockFacetAdmin.schedule(target, value, data, predecessor, TEST_DELAY, salt);
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
        operationId = event.args.operationId;
      });

      it('should schedule an operation correctly', async function () {
        const salt = ethers.randomBytes(32);
        
        const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
        await timelockFacetAdmin.schedule(target, value, data, predecessor, TEST_DELAY, salt);
        
        operationId = await contracts.timelockFacet.hashOperation(target, value, data, predecessor, salt);
        
        const state = await contracts.timelockFacet.getOperationState(operationId);
        assert.equal(state, OperationState.Pending, 'Operation should be in Pending state');
        
        const isPending = await contracts.timelockFacet.isOperationPending(operationId);
        assert.isTrue(isPending, 'Operation should be pending');
      });

      it('should execute an operation after delay', async function () {
        // 生成随机salt
        const salt = ethers.randomBytes(32);
        
        const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
        const tx = await timelockFacetAdmin.schedule(target, value, data, predecessor, TEST_DELAY, salt);
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
        operationId = event.args.operationId;
        
        await ethers.provider.send('evm_increaseTime', [TEST_DELAY + 1]);
        await ethers.provider.send('evm_mine');
        
        const isReady = await contracts.timelockFacet.isOperationReady(operationId);
        assert.isTrue(isReady, 'Operation should be ready to execute');
      
        await timelockFacetAdmin.execute(target, value, data, predecessor, salt);
        
        const state = await contracts.timelockFacet.getOperationState(operationId);
        assert.equal(state, OperationState.Done, 'Operation should be in Done state');
        
        const isDone = await contracts.timelockFacet.isOperationDone(operationId);
        assert.isTrue(isDone, 'Operation should be done');
      });
    });

    describe('Operation Cancellation', function () {
      let operationId;
      let target;
      let value;
      let data;
      let predecessor;
      
      beforeEach(async function () {
        target = contracts.diamondAddress;
        value = 0;

        data = contracts.diamondLoupeFacet.interface.encodeFunctionData('facetAddresses', []);
        predecessor = ethers.ZeroHash;
        const salt = ethers.randomBytes(32);
        
        const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
        const tx = await timelockFacetAdmin.schedule(target, value, data, predecessor, TEST_DELAY, salt);
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
        operationId = event.args.operationId;
      });

      it('should cancel an operation by admin', async function () {
        const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
        await timelockFacetAdmin.cancel(operationId);
        
        const state = await contracts.timelockFacet.getOperationState(operationId);
        assert.equal(state, OperationState.Cancelled, 'Operation should be in Cancelled state');
        
        const isPending = await contracts.timelockFacet.isOperationPending(operationId);
        assert.isFalse(isPending, 'Operation should not be pending');
      });

      it('should emergency cancel an operation', async function () {
        const timelockFacetEmergency = contracts.timelockFacet.connect(accounts.emergency);
        await timelockFacetEmergency.emergencyCancel(operationId);
        
        const state = await contracts.timelockFacet.getOperationState(operationId);
        assert.equal(state, OperationState.Cancelled, 'Operation should be in Cancelled state');
      });
    });
  });

  describe('Permission Control', function () {
    let operationId;
    let target;
    let value;
    let data;
    let predecessor;
    
    beforeEach(async function () {
      target = contracts.diamondAddress;
      value = 0;
      data = ethers.randomBytes(32);
      predecessor = ethers.ZeroHash;
      const salt = ethers.randomBytes(32);
      
      const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
      const tx = await timelockFacetAdmin.schedule(target, value, data, predecessor, TEST_DELAY, salt);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
      operationId = event.args.operationId;
    });

    it('should not allow non-admin to schedule operations', async function () {
      const timelockFacetUser = contracts.timelockFacet.connect(accounts.user);
      
      const salt = ethers.randomBytes(32);
      await expect(
        timelockFacetUser.schedule(target, value, ethers.randomBytes(32), predecessor, TEST_DELAY, salt)
      ).to.be.reverted;
    });

    it('should not allow non-admin to cancel operations', async function () {
      const timelockFacetUser = contracts.timelockFacet.connect(accounts.user);
      
      await expect(
        timelockFacetUser.cancel(operationId)
      ).to.be.reverted;
    });

    it('should not allow non-emergency role to emergency cancel', async function () {
      const timelockFacetUser = contracts.timelockFacet.connect(accounts.user);
      
      await expect(
        timelockFacetUser.emergencyCancel(operationId)
      ).to.be.reverted;
    });
  });

  describe('Event Emission', function () {
    it('should emit OperationScheduled event', async function () {
      const target = contracts.diamondAddress;
      const value = 0;
      const data = ethers.randomBytes(32);
      const predecessor = ethers.ZeroHash;
      
      const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
      
      const tx = await timelockFacetAdmin.schedule(target, value, data, predecessor, TEST_DELAY, ethers.randomBytes(32));
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
      const operationId = event.args.operationId;
      
      expect(event).to.not.be.undefined;
    });

    it('should emit OperationExecuted event', async function () {
      const target = contracts.diamondAddress;
      const value = 0;
      data = contracts.diamondLoupeFacet.interface.encodeFunctionData('facetAddresses', []);
      const predecessor = ethers.ZeroHash;
      
      const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
      const salt = ethers.randomBytes(32);
      const tx = await timelockFacetAdmin.schedule(target, value, data, predecessor, TEST_DELAY, salt);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
      const operationId = event.args.operationId;
      
      await ethers.provider.send('evm_increaseTime', [TEST_DELAY + 1]);
      await ethers.provider.send('evm_mine');
      
      await expect(timelockFacetAdmin.execute(target, value, data, predecessor, salt))
        .to.emit(contracts.timelockFacet, 'TimelockOperationExecuted');
    });

    it('should emit OperationCancelled event', async function () {
      const target = contracts.diamondAddress;
      const value = 0;
      const data = ethers.randomBytes(32);
      const predecessor = ethers.ZeroHash;
      
      const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
      const salt = ethers.randomBytes(32);
      const tx = await timelockFacetAdmin.schedule(target, value, data, predecessor, TEST_DELAY, salt);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TimelockOperationScheduled');
      const operationId = event.args.operationId;
      
      await expect(timelockFacetAdmin.cancel(operationId))
        .to.emit(contracts.timelockFacet, 'OperationCancelled');
    });

    it('should emit MinDelayChanged event', async function () {
      const timelockFacetAdmin = contracts.timelockFacet.connect(accounts.owner);
      await expect(timelockFacetAdmin.updateDelay(NEW_DELAY + 100))
        .to.emit(contracts.timelockFacet, 'MinDelayChanged');
    });
  });
});