const { getSelectors } = require('../scripts/libraries/diamond.js');
const { assert, expect } = require('chai');
const { deployParentLayerDiamond } = require('../scripts/deployParentLayer.js');
const { ethers } = require('hardhat');

describe('DiamondCutTimelockTest', async function () {
  const TEST_DELAY = 10; 

  const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes('EMERGENCY_ROLE'));

  let contracts;
  let accounts;

  async function setupContracts() {
    const diamondAddress = await deployParentLayerDiamond();
    
    const diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress);
    const diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress);
    const ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress);
    const accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);
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
      console.log('AccessControl initialized');
    } catch (error) {
      console.log('AccessControl already initialized or error:', error.message);
    }

    await contracts.accessControlFacet.grantRole(DEFAULT_ADMIN_ROLE, accounts.admin.address);
    await contracts.accessControlFacet.grantRole(EMERGENCY_ROLE, accounts.emergency.address);

    await contracts.timelockFacet.initializeTimelock(TEST_DELAY);

    console.log('============DiamondCut Timelock Test============');
  });

  describe('Diamond Cut with Timelock', function () {
    describe('Basic Diamond Cut Operations', function () {
      let testFacetAddress;
      let functionSelectors;
      let diamondCut;

      beforeEach(async function () {
        const TestFacet = await ethers.getContractFactory('DiamondLoupeFacet');
        testFacetAddress = await TestFacet.deploy();
        await testFacetAddress.waitForDeployment();

        functionSelectors = getSelectors(testFacetAddress);
        diamondCut = [{
          facetAddress: testFacetAddress.address,
          action: 0, // Add
          functionSelectors: functionSelectors
        }];
      });

      it('should schedule a diamond cut operation', async function () {
        await contracts.diamondCutFacet.scheduleDiamondCut(
          diamondCut,
          ethers.ZeroAddress,
          '0x',
          TEST_DELAY
        );

        const operationId = await contracts.timelockFacet.hashOperation(
          contracts.diamondAddress,
          0,
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[]', 'address', 'bytes'],
            [diamondCut, ethers.ZeroAddress, '0x']
          ),
          ethers.ZeroHash
        );

        const isPending = await contracts.timelockFacet.isOperationPending(operationId);
        assert.isTrue(isPending, 'Diamond cut operation should be pending');
      });

      it('should execute a diamond cut operation after delay', async function () {
        await contracts.diamondCutFacet.scheduleDiamondCut(
          diamondCut,
          ethers.ZeroAddress,
          '0x',
          TEST_DELAY
        );

        await ethers.provider.send('evm_increaseTime', [TEST_DELAY + 1]);
        await ethers.provider.send('evm_mine');

        await contracts.diamondCutFacet.diamondCut(
          diamondCut,
          ethers.ZeroAddress,
          '0x'
        );

        const facetAddresses = await contracts.diamondLoupeFacet.facetAddresses();
        assert.include(facetAddresses, testFacetAddress.address, 'New facet should be added');
      });

      it('should not execute diamond cut before delay', async function () {
        await contracts.diamondCutFacet.scheduleDiamondCut(
          diamondCut,
          ethers.ZeroAddress,
          '0x',
          TEST_DELAY
        );

        await expect(
          contracts.diamondCutFacet.diamondCut(
            diamondCut,
            ethers.ZeroAddress,
            '0x'
          )
        ).to.be.revertedWith('DiamondCutFacet: operation not ready');
      });
    });

    describe('Operation Management', function () {
      let testFacetAddress;
      let functionSelectors;
      let diamondCut;

      beforeEach(async function () {
        const TestFacet = await ethers.getContractFactory('DiamondLoupeFacet');
        testFacetAddress = await TestFacet.deploy();
        await testFacetAddress.waitForDeployment();

        functionSelectors = getSelectors(testFacetAddress);
        diamondCut = [{
          facetAddress: testFacetAddress.address,
          action: 0, // Add
          functionSelectors: functionSelectors
        }];
      });

      it('should cancel a scheduled diamond cut operation', async function () {
        await contracts.diamondCutFacet.scheduleDiamondCut(
          diamondCut,
          ethers.ZeroAddress,
          '0x',
          TEST_DELAY
        );

        await contracts.diamondCutFacet.cancelDiamondCut(
          diamondCut,
          ethers.ZeroAddress,
          '0x'
        );

        const operationId = await contracts.timelockFacet.hashOperation(
          contracts.diamondAddress,
          0,
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[]', 'address', 'bytes'],
            [diamondCut, ethers.ZeroAddress, '0x']
          ),
          ethers.ZeroHash
        );

        const state = await contracts.timelockFacet.getOperationState(operationId);
        assert.equal(state, 4, 'Operation should be cancelled'); // 4 = Cancelled
      });

      it('should not allow unauthorized users to schedule diamond cut', async function () {
        const diamondCutFacetUser = contracts.diamondCutFacet.connect(accounts.user);
        await expect(
          diamondCutFacetUser.scheduleDiamondCut(
            diamondCut,
            ethers.ZeroAddress,
            '0x',
            TEST_DELAY
          )
        ).to.be.reverted;
      });
    });
  });
});