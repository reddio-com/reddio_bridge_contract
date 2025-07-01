
# reddio_evm_bridge
This directory contains the Solidity code for Reddio's L1 and L2 bridge contracts implemented using the Diamond Proxy pattern (EIP-2535). The Diamond standard allows for modular and upgradeable smart contracts by separating functionality into multiple facets.
Diamond Proxy Pattern (EIP-2535)
    The Diamond Proxy pattern enables:

    Modular design: Functionality is split into independent facets

    Upgradeability: Individual facets can be upgraded without affecting others

    Size management: Avoids Ethereum contract size limitations

    Clear separation: Storage, logic, and interfaces are separated

    Learn more about EIP-2535（https://eips.ethereum.org/EIPS/eip-2535）

## Directory Structure
<pre> 
├── <a href="./Diamond.sol">Diamond.sol</a> - Main diamond proxy contract 
├── <a href="./access/">access</a> - Access control contracts (Ownable, Roles, etc.) 
├── <a href="./childLayer/">childLayer</a> - L2 bridge contracts (Reddio L2) 
├── <a href="./common/">common</a> - Shared utilities and libraries 
├── <a href="./interfaces/">interfaces</a> - Core contract interfaces 
├── <a href="./libraries/">libraries</a> - Reusable libraries and utilities 
├── <a href="./parentLayer/">parentLayer</a> - L1 bridge contracts (Ethereum) 
├── <a href="./storage/">storage</a> - Diamond storage layout definitions 
├── <a href="./tokens/">tokens</a> - Token contracts (ERC20, ERC721, etc.) 
└── <a href="./utils/">utils</a> - Utility contracts and helpers 
</pre>



## Installation

#### Clone this repo:

```console
git clone https://github.com/reddio-com/reddio_bridge_contract.git
```

#### Install NPM packages:

```console
cd evm-bridge
npm install
```

#### Environment variables

.sepolia.env

```bash
export HARDHAT_ENV=sepolia
export DIAMOND_ADDRESS=...
export RPC_PROVIDER=...
export ADMIN_PRIVATE_KEY=...
export ETHERSCAN_KEY=...
```

.localhost.env

```bash
export HARDHAT_ENV=localhost
export DIAMOND_ADDRESS=...
export RPC_PROVIDER=...
export ADMIN_PRIVATE_KEY=...
export ETHERSCAN_KEY=...
```

#### Deploy

deploy parentLayer on sepolia

```bash
npm run deployParentLayer:sepolia
```

deploy childLayer on localhost

```bash
npm run deployChildLayer:localhost
```

#### Run clients

run parentLayer client on sepolia

```bash
npm run parentClient:sepolia
```

run childLayer client on localhost

```bash
npm run childClient:localhost
```

## License
This project is licensed under the Apache-2.0 License.