const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployParentLayerDiamond } = require("../scripts/deployParentLayer.js");
const { FacetCutAction } = require("../scripts/libraries/diamond.js");
const { readArtifactAbi } = require('../scripts/libraries/utils.js');
const { getSelectors } = require('../scripts/libraries/diamond.js');

describe("AccessControl", function () {
  let diamond;
  let diamondCutFacet;
  let accessControlFacet;
  let owner;
  let operator;
  let emergency;
  let user;

  const OPERATOR_ROLE = ethers.keccak256(ethers.encodeBytes32String("OPERATOR_ROLE"));
  const EMERGENCY_ROLE = ethers.keccak256(ethers.encodeBytes32String("EMERGENCY_ROLE"));
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  before(async function () {
    [owner, operator, emergency, user] = await ethers.getSigners();
  });

  async function deployAndInitializeAccessControlFacet() {
    // Use the provided Diamond address
    const diamondAddress = await deployParentLayerDiamond();
    diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", diamondAddress);

    const ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress);

    const AccessControlFactory = await ethers.getContractFactory("AccessControlFacet");
    const accessControlFacetInstance = await AccessControlFactory.deploy();
    await accessControlFacetInstance.waitForDeployment();

    const accessControlFacetContract = await ethers.getContractAt("AccessControlFacet", accessControlFacetInstance.target);
    const accessControlFacetAbi = await readArtifactAbi("AccessControlFacet");
    const accessControlFacet = await ethers.getContractAt('AccessControlFacet', diamondAddress);
    
    const cut = [{
      facetAddress: accessControlFacetInstance.target,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(accessControlFacetContract)
    }];

    await diamondCutFacet.diamondCut(cut, ethers.ZeroAddress, "0x");
    
    await accessControlFacet.initializeAccessControl();
    return accessControlFacet;
  }

  describe("AccessControlFacet", function () {
    beforeEach(async function () {
      accessControlFacet = await deployAndInitializeAccessControlFacet();
    });

    describe("Deployment and Initialization", function () {
      it("should successfully deploy and initialize AccessControlFacet", async function () {
        expect(await accessControlFacet.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      });
    });

    describe("Role Management", function () {
      describe("Admin Operations", function () {
        it("should allow admin to grant operator role", async function () {
          await accessControlFacet.grantRole(OPERATOR_ROLE, operator.address);
          expect(await accessControlFacet.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
        });

        it("should allow admin to grant emergency role", async function () {
          await accessControlFacet.grantRole(EMERGENCY_ROLE, emergency.address);
          expect(await accessControlFacet.hasRole(EMERGENCY_ROLE, emergency.address)).to.be.true;
        });

        it("should allow admin to revoke operator role", async function () {
          await accessControlFacet.grantRole(OPERATOR_ROLE, operator.address);
          await accessControlFacet.revokeRole(OPERATOR_ROLE, operator.address);
          expect(await accessControlFacet.hasRole(OPERATOR_ROLE, operator.address)).to.be.false;
        });
      });

      describe("Access Restrictions", function () {
        it("should not allow non-admin to grant roles", async function () {
          await expect(
            accessControlFacet.connect(user).grantRole(OPERATOR_ROLE, user.address)
          ).to.be.revertedWithCustomError(accessControlFacet, "AccessControlUnauthorizedAdmin")
          .withArgs(user.address, OPERATOR_ROLE, DEFAULT_ADMIN_ROLE);
        });

        it("should not allow non-admin to revoke roles", async function () {
          await accessControlFacet.grantRole(OPERATOR_ROLE, operator.address);
          await expect(
            accessControlFacet.connect(user).revokeRole(OPERATOR_ROLE, operator.address)
          ).to.be.revertedWithCustomError(accessControlFacet, "AccessControlUnauthorizedAdmin")
          .withArgs(user.address, OPERATOR_ROLE, DEFAULT_ADMIN_ROLE);
        });

        it("should not allow operator to grant emergency role", async function () {
          await accessControlFacet.grantRole(OPERATOR_ROLE, operator.address);
          await expect(
            accessControlFacet.connect(operator).grantRole(EMERGENCY_ROLE, user.address)
          ).to.be.revertedWithCustomError(accessControlFacet, "AccessControlUnauthorizedAdmin")
          .withArgs(operator.address, EMERGENCY_ROLE, DEFAULT_ADMIN_ROLE);
        });
      });
    });

    describe("Role Verification", function () {
      beforeEach(async function () {
        accessControlFacet = await deployAndInitializeAccessControlFacet();
        await accessControlFacet.grantRole(OPERATOR_ROLE, operator.address);
        await accessControlFacet.grantRole(EMERGENCY_ROLE, emergency.address);
      });

      it("should correctly verify operator role", async function () {
        expect(await accessControlFacet.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
        expect(await accessControlFacet.hasRole(OPERATOR_ROLE, user.address)).to.be.false;
      });

      it("should correctly verify emergency role", async function () {
        expect(await accessControlFacet.hasRole(EMERGENCY_ROLE, emergency.address)).to.be.true;
        expect(await accessControlFacet.hasRole(EMERGENCY_ROLE, user.address)).to.be.false;
      });

      it("should correctly get role admin", async function () {
        expect(await accessControlFacet.getRoleAdmin(OPERATOR_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
        expect(await accessControlFacet.getRoleAdmin(EMERGENCY_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
      });

      it("should allow admin to set new role admin", async function () {
        await expect(accessControlFacet.setRoleAdmin(OPERATOR_ROLE, EMERGENCY_ROLE))
          .to.emit(accessControlFacet, "RoleAdminChanged")
          .withArgs(OPERATOR_ROLE, DEFAULT_ADMIN_ROLE, EMERGENCY_ROLE);

        expect(await accessControlFacet.getRoleAdmin(OPERATOR_ROLE)).to.equal(EMERGENCY_ROLE);
      });

      it("should not allow non-owner to set role admin", async function () {
        await expect(
          accessControlFacet.connect(operator).setRoleAdmin(OPERATOR_ROLE, EMERGENCY_ROLE)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });

    describe("Events", function () {
      beforeEach(async function () {
        accessControlFacet = await deployAndInitializeAccessControlFacet();
      });

      it("should emit RoleGranted event when granting role", async function () {
        await expect(accessControlFacet.grantRole(OPERATOR_ROLE, operator.address))
          .to.emit(accessControlFacet, "RoleGranted")
          .withArgs(OPERATOR_ROLE, operator.address, owner.address);
      });

      it("should emit RoleRevoked event when revoking role", async function () {
        await accessControlFacet.grantRole(OPERATOR_ROLE, operator.address);
        await expect(accessControlFacet.revokeRole(OPERATOR_ROLE, operator.address))
          .to.emit(accessControlFacet, "RoleRevoked")
          .withArgs(OPERATOR_ROLE, operator.address, owner.address);
      });
    });

    describe("Multiple Role Management", function () {
      beforeEach(async function () {
        accessControlFacet = await deployAndInitializeAccessControlFacet();
      });

      it("should allow account to have multiple roles", async function () {
        await accessControlFacet.grantRole(OPERATOR_ROLE, user.address);
        await accessControlFacet.grantRole(EMERGENCY_ROLE, user.address);
        expect(await accessControlFacet.hasRole(OPERATOR_ROLE, user.address)).to.be.true;
        expect(await accessControlFacet.hasRole(EMERGENCY_ROLE, user.address)).to.be.true;
      });

      it("should correctly revoke one role while keeping others", async function () {
        await accessControlFacet.grantRole(OPERATOR_ROLE, user.address);
        await accessControlFacet.grantRole(EMERGENCY_ROLE, user.address);
        await accessControlFacet.revokeRole(OPERATOR_ROLE, user.address);
        expect(await accessControlFacet.hasRole(OPERATOR_ROLE, user.address)).to.be.false;
        expect(await accessControlFacet.hasRole(EMERGENCY_ROLE, user.address)).to.be.true;
      });
    });

    describe("Edge Cases", function () {
      it("should handle granting role to existing role holder", async function () {
        await accessControlFacet.grantRole(OPERATOR_ROLE, operator.address);
        await expect(accessControlFacet.grantRole(OPERATOR_ROLE, operator.address))
          .to.not.be.reverted;
      });

      it("should handle revoking role from non-role holder", async function () {
        await expect(accessControlFacet.revokeRole(OPERATOR_ROLE, user.address))
          .to.not.be.reverted;
      });
    });

    describe("Role Hierarchy", function () {
      it("should allow admin role to manage multiple roles", async function () {
        await accessControlFacet.grantRole(OPERATOR_ROLE, operator.address);
        await accessControlFacet.grantRole(EMERGENCY_ROLE, operator.address);
        expect(await accessControlFacet.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
        expect(await accessControlFacet.hasRole(EMERGENCY_ROLE, operator.address)).to.be.true;
      });

      it("should maintain role hierarchy after admin changes", async function () {
        await accessControlFacet.setRoleAdmin(OPERATOR_ROLE, EMERGENCY_ROLE);
        await accessControlFacet.grantRole(EMERGENCY_ROLE, emergency.address);
        await accessControlFacet.connect(emergency).grantRole(OPERATOR_ROLE, user.address);
        expect(await accessControlFacet.hasRole(OPERATOR_ROLE, user.address)).to.be.true;
      });
    });
  });
});