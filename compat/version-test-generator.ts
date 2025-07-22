import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { TestCase } from "../packages/web-solc/tests/test-utils.js";
import { getContractForVersion } from "../packages/web-solc/tests/contracts/version-mapping.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper to load the appropriate contract for a version
function loadContractForVersion(version: string): {
  source: string;
  contractName: string;
} {
  try {
    const { fileName, contractName } = getContractForVersion(version);
    const source = readFileSync(
      resolve(__dirname, "../packages/web-solc/tests/contracts", fileName),
      "utf-8"
    );
    return { source, contractName };
  } catch {
    // For versions not covered by getContractForVersion, create inline
    const [majorStr, minorStr, patchStr] = version.split(".");
    const major = parseInt(majorStr);
    const minor = parseInt(minorStr);
    const patch = parseInt(patchStr);
    const majorMinor = `${major}.${minor}`;

    // Handle edge cases for specific version ranges
    if (major === 0 && minor === 4 && patch >= 11 && patch <= 15) {
      // constant instead of view
      return {
        source: `pragma solidity ^${majorMinor}.0;

contract Test {
  uint public value;
  
  function Test() public {
    value = 42;
  }
  
  function getValue() public constant returns (uint) {
    return value;
  }
}`,
        contractName: "Test",
      };
    }

    if (major === 0 && minor === 4 && patch >= 16 && patch <= 21) {
      // view keyword but still function-named constructor
      return {
        source: `pragma solidity ^${majorMinor}.0;

contract Test {
  uint public value;
  
  function Test() public {
    value = 42;
  }
  
  function getValue() public view returns (uint) {
    return value;
  }
}`,
        contractName: "Test",
      };
    }

    throw new Error(`No contract available for version ${version}`);
  }
}

// All stable Solidity versions from the official releases
const allVersions = [
  "0.1.1",
  "0.1.2",
  "0.1.3",
  "0.1.4",
  "0.1.5",
  "0.1.6",
  "0.1.7",
  "0.2.0",
  "0.2.1",
  "0.2.2",
  "0.3.0",
  "0.3.1",
  "0.3.2",
  "0.3.3",
  "0.3.4",
  "0.3.5",
  "0.3.6",
  "0.4.0",
  "0.4.1",
  "0.4.2",
  "0.4.3",
  "0.4.4",
  "0.4.5",
  "0.4.6",
  "0.4.7",
  "0.4.8",
  "0.4.9",
  "0.4.10",
  "0.4.11",
  "0.4.12",
  "0.4.13",
  "0.4.14",
  "0.4.15",
  "0.4.16",
  "0.4.17",
  "0.4.18",
  "0.4.19",
  "0.4.20",
  "0.4.21",
  "0.4.22",
  "0.4.23",
  "0.4.24",
  "0.4.25",
  "0.4.26",
  "0.5.0",
  "0.5.1",
  "0.5.2",
  "0.5.3",
  "0.5.4",
  "0.5.5",
  "0.5.6",
  "0.5.7",
  "0.5.8",
  "0.5.9",
  "0.5.10",
  "0.5.11",
  "0.5.12",
  "0.5.13",
  "0.5.14",
  "0.5.15",
  "0.5.16",
  "0.5.17",
  "0.6.0",
  "0.6.1",
  "0.6.2",
  "0.6.3",
  "0.6.4",
  "0.6.5",
  "0.6.6",
  "0.6.7",
  "0.6.8",
  "0.6.9",
  "0.6.10",
  "0.6.11",
  "0.6.12",
  "0.7.0",
  "0.7.1",
  "0.7.2",
  "0.7.3",
  "0.7.4",
  "0.7.5",
  "0.7.6",
  "0.8.0",
  "0.8.1",
  "0.8.2",
  "0.8.3",
  "0.8.4",
  "0.8.5",
  "0.8.6",
  "0.8.7",
  "0.8.8",
  "0.8.9",
  "0.8.10",
  "0.8.11",
  "0.8.12",
  "0.8.13",
  "0.8.14",
  "0.8.15",
  "0.8.16",
  "0.8.17",
  "0.8.18",
  "0.8.19",
  "0.8.20",
  "0.8.21",
  "0.8.22",
  "0.8.23",
  "0.8.24",
  "0.8.25",
  "0.8.26",
  "0.8.27",
  "0.8.28",
  "0.8.29",
  "0.8.30",
];

// Generate test cases for ALL versions - no skipping!
export const testCases: TestCase[] = allVersions.map((version) => {
  const { source, contractName } = loadContractForVersion(version);

  return {
    version,
    description: `Solidity ${version}`,
    contract: {
      fileName: "test.sol",
      source,
      contractName,
    },
    assertions: [
      { path: "abi", operator: "exists" },
      { path: "evm.bytecode.object", operator: "exists" },
      {
        path: "evm.bytecode.object",
        operator: "length",
        value: 10, // At least some bytecode
        description: "Has bytecode",
      },
    ],
  };
});
