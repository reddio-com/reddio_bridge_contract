const { getSelectors } = require('./libraries/diamond.js');
const { deployReentrancyGuard } = require('./deployReentrancyGuard.js');

async function upgradeReentrancyGuard(diamondAddress, oldFacetAddress) {
  const { reentrancyGuardFacet, selectors: newSelectors } = await deployReentrancyGuard();

  // Get DiamondCut and DiamondLoupe contract instances
  const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress);
  const diamondLoupe = await ethers.getContractAt('IDiamondLoupe', diamondAddress);

  // Get selectors from old facet
  const oldSelectors = await diamondLoupe.facetFunctionSelectors(oldFacetAddress);

  // Calculate selector changes
  const newSelectorSet = new Set(newSelectors);
  const oldSelectorSet = new Set(oldSelectors);

  const addedSelectors = newSelectors.filter(selector => !oldSelectorSet.has(selector));
  const removedSelectors = oldSelectors.filter(selector => !newSelectorSet.has(selector));
  const unchangedSelectors = newSelectors.filter(selector => oldSelectorSet.has(selector));

  const cuts = [];

  // Add new selectors
  if (addedSelectors.length > 0) {
    cuts.push({
      facetAddress: reentrancyGuardFacet,
      action: 0, // Add
      functionSelectors: addedSelectors
    });
  }

  // Replace unchanged selectors
  if (unchangedSelectors.length > 0) {
    cuts.push({
      facetAddress: reentrancyGuardFacet,
      action: 1, // Replace
      functionSelectors: unchangedSelectors
    });
  }

  // Remove unused selectors
  if (removedSelectors.length > 0) {
    cuts.push({
      facetAddress: ethers.constants.AddressZero,
      action: 2, // Remove
      functionSelectors: removedSelectors
    });
  }

  // Execute upgrade
  for (const cut of cuts) {
    const tx = await diamondCut.diamondCut([cut], ethers.constants.AddressZero, '0x');
    await tx.wait();
  }

  console.log('ReentrancyGuard upgrade completed');
  return reentrancyGuardFacet;
}

module.exports = {
  upgradeReentrancyGuard
};