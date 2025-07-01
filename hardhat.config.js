/* global ethers task */
require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-ledger');
const { RPC_PROVIDER, ETHERSCAN_KEY, ADMIN_PRIVATE_KEY, ADMIN_LEDGER_ADDRESS, TEST_BLOCK_NUMBER,TEST_PRIVATE_KEY_2,TEST_PRIVATE_KEY_3 } = process.env;

if (!RPC_PROVIDER) {
  throw new Error('Please set RPC_PROVIDER in environment');
}

if (!ADMIN_PRIVATE_KEY && !ADMIN_LEDGER_ADDRESS) {
  throw new Error('Please set ADMIN_PRIVATE_KEY or ADMIN_LEDGER_ADDRESS in environment');
}

const config = {
  networks: {},
  mocha: {
    timeout: 90000, // timeout in milliseconds
  },
  solidity: '0.8.24',
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

if (ETHERSCAN_KEY) {
  config.etherscan = { apiKey: ETHERSCAN_KEY };
}

if (ADMIN_PRIVATE_KEY) {
  const accounts = [ADMIN_PRIVATE_KEY];
  if (TEST_PRIVATE_KEY_2) {
    accounts.push(TEST_PRIVATE_KEY_2); 
  }
  if (TEST_PRIVATE_KEY_3) {
    accounts.push(TEST_PRIVATE_KEY_3); 
  }

  config.networks.hardhat = {
    chainId: 1337,
    forking: {
      url: RPC_PROVIDER,
      accounts: [ADMIN_PRIVATE_KEY],
      blockNumber: Number(TEST_BLOCK_NUMBER || 0),
    },
  };
  config.networks.sepolia = {
    url: RPC_PROVIDER,
    accounts: [ADMIN_PRIVATE_KEY],
  };
  config.networks.prod = {
    url: RPC_PROVIDER,
    accounts: [ADMIN_PRIVATE_KEY],
  };
  config.networks.reddio = {
    url: RPC_PROVIDER,
    accounts: [ADMIN_PRIVATE_KEY],
    timeout: 120000, 
  };
  config.networks.localhost = {
    url: RPC_PROVIDER,
    accounts: accounts,
  };
}

if (ADMIN_LEDGER_ADDRESS) {
  config.networks.sepolia_ledger = {
    url: RPC_PROVIDER,
    ledgerAccounts: [ADMIN_LEDGER_ADDRESS],
  };
  config.networks.prod_ledger = {
    url: RPC_PROVIDER,
    ledgerAccounts: [ADMIN_LEDGER_ADDRESS],
  };
}

module.exports = config;
