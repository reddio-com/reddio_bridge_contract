const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  let success = 0;
  let fail = 0;
  const testTimes = 10;

  for (let i = 0; i < testTimes; i++) {
    try {
      console.log(`Test #${i + 1} ...`);
      const blockNumber = await provider.getBlockNumber();
      console.log("Success, blockNumber:", blockNumber);
      success++;
    } catch (e) {
      console.error("Error:", e.message);
      fail++;
    }
  }

  console.log(`\nTotal: ${testTimes}, Success: ${success}, Fail: ${fail}`);
}

main().catch(console.error);