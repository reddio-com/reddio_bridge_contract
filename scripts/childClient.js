const { readArtifactAbi } = require('./libraries/utils.js');
const { DIAMOND_ADDRESS } = process.env;

async function main() {
  const inquirer = (await import('inquirer')).default;

  const diamondCutFacetAbi = await readArtifactAbi('DiamondCutFacet');
  const diamondLoupeFacetAbi = await readArtifactAbi('DiamondLoupeFacet');
  const ownershipFacetAbi = await readArtifactAbi('OwnershipFacet');
  const childBridgeCoreFacetAbi = await readArtifactAbi('ChildBridgeCoreFacet');
  const downwardMessageDispatcherFacetAbi = await readArtifactAbi('DownwardMessageDispatcherFacet');
  const childTokenMessageProcessorFacetAbi = await readArtifactAbi('ChildTokenMessageProcessorFacet');
  const childTokenMessageTransmitterFacetAbi = await readArtifactAbi('ChildTokenMessageTransmitterFacet');

  const countFunctions = (abi) => abi.filter((item) => item.type === 'function').length;

  const facetChoices = [
    { name: `DiamondCutFacet (${countFunctions(diamondCutFacetAbi)} functions)`, value: diamondCutFacetAbi },
    { name: `DiamondLoupeFacet (${countFunctions(diamondLoupeFacetAbi)} functions)`, value: diamondLoupeFacetAbi },
    { name: `OwnershipFacet (${countFunctions(ownershipFacetAbi)} functions)`, value: ownershipFacetAbi },
    {
      name: `ChildBridgeCoreFacet (${countFunctions(childBridgeCoreFacetAbi)} functions)`,
      value: childBridgeCoreFacetAbi,
    },
    {
      name: `DownwardMessageDispatcherFacet (${countFunctions(downwardMessageDispatcherFacetAbi)} functions)`,
      value: downwardMessageDispatcherFacetAbi,
    },
    {
      name: `ChildTokenMessageProcessorFacet (${countFunctions(childTokenMessageProcessorFacetAbi)} functions)`,
      value: childTokenMessageProcessorFacetAbi,
    },
    {
      name: `ChildTokenMessageTransmitterFacet (${countFunctions(childTokenMessageTransmitterFacetAbi)} functions)`,
      value: childTokenMessageTransmitterFacetAbi,
    },
  ];

  const { selectedFacet } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedFacet',
      message: 'Select the contract to interact with:',
      choices: facetChoices,
    },
  ]);

  const abi = selectedFacet;
  const contractAddress = DIAMOND_ADDRESS;

  if (!contractAddress) {
    console.error(`Contract address not found in environment variables`);
    process.exit(1);
  }

  const contract = new ethers.Contract(contractAddress, abi, ethers.provider);

  const viewFunctions = abi.filter((item) => item.type === 'function' && item.stateMutability === 'view');
  const executeFunctions = abi.filter((item) => item.type === 'function' && item.stateMutability !== 'view');

  const functionTypes = [];
  if (viewFunctions.length > 0) {
    functionTypes.push({ name: `View functions (${viewFunctions.length})`, value: 'view' });
  }
  if (executeFunctions.length > 0) {
    functionTypes.push({ name: `Execute functions (${executeFunctions.length})`, value: 'execute' });
  }

  if (functionTypes.length === 0) {
    console.error(`No callable functions found in the selected contract`);
    process.exit(1);
  }

  const { functionType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'functionType',
      message: 'Select the type of function to call:',
      choices: functionTypes,
    },
  ]);

  const functionChoices = abi
    .filter(
      (item) =>
        item.type === 'function' &&
        (functionType === 'view' ? item.stateMutability === 'view' : item.stateMutability !== 'view'),
    )
    .map((item) => ({
      name: `${item.name} (${item.inputs.map((input) => input.type).join(', ')})`,
      value: item,
    }));

  const { selectedFunction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedFunction',
      message: 'Select the function to execute:',
      choices: functionChoices,
    },
  ]);

  const selectedFunctionAbi = selectedFunction;
  const args = [];

  for (let input of selectedFunctionAbi.inputs) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: input.name,
        message: `Enter ${input.name} (${input.type}):`,
        validate: (value) => {
          if (!value) return 'This parameter cannot be empty';
          return true;
        },
      },
    ]);

    let value = answer[input.name];
    if (input.type === 'address') {
    } else if (input.type === 'uint256' || input.type === 'uint') {
      value = BigInt(value).toString();
    } else if (input.type.includes('[]')) {
      value = JSON.parse(value).map((v) => {
        if (input.type === 'address[]') {
          return v;
        } else if (input.type === 'uint256[]' || input.type === 'uint[]') {
          return ethers.BigNumber.from(v);
        }
        return v;
      });
    }
    args.push(value);
  }

  console.log(`Function to be called: ${selectedFunctionAbi.name}`);
  if (args.length > 0) {
    console.log(`Arguments: ${JSON.stringify(args)}`);
  }

  if (functionType === 'view') {
    try {
      const result = await contract[selectedFunctionAbi.name](...args);
      console.log('Call result:', result);
    } catch (error) {
      console.error('Call failed:', error);
    }
  } else {
    const signer = (await ethers.getSigners())[0];
    const contractWithSigner = contract.connect(signer);

    const { confirmation } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmation',
        message: `Confirm execution of ${selectedFunctionAbi.name}?`,
        default: false,
      },
    ]);

    if (confirmation) {
      try {
        const tx = await contractWithSigner[selectedFunctionAbi.name](...args);
        console.log('Transaction sent, waiting for confirmation...');
        await tx.wait();
        console.log('Transaction confirmed:', tx);
        console.log('Transaction hash:', tx.hash);
      } catch (error) {
        console.error('Transaction failed:', error);
      }
    } else {
      console.log('Transaction canceled');
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
