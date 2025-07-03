import { expect } from "vitest";

export interface CompileInput {
  language: string;
  sources: Record<string, { content: string }>;
  settings: {
    outputSelection: Record<string, Record<string, string[]>>;
    optimizer?: {
      enabled: boolean;
      runs: number;
    };
  };
}

export interface CompileOutput {
  contracts?: Record<string, Record<string, unknown>>;
  errors?: Array<{ severity: string; message: string }>;
}

export interface CompiledContract {
  abi?: Array<{ name?: string; type: string }>;
  evm?: {
    bytecode?: {
      object?: string;
    };
  };
}

export interface TestAssertion {
  path: string;
  operator: "exists" | "equals" | "contains" | "length" | "greaterThan";
  value?: unknown;
  description?: string;
}

export interface TestCase {
  version: string;
  skip?: boolean;
  description: string;
  contract: {
    fileName: string;
    source: string;
    contractName: string;
  };
  compilerSettings?: {
    optimizer?: {
      enabled: boolean;
      runs: number;
    };
  };
  assertions: TestAssertion[];
}

// Define all test cases as data
export const testCases: TestCase[] = [
  {
    version: "0.8.19",
    description: "Basic Hello World contract",
    contract: {
      fileName: "test.sol",
      source: `pragma solidity ^0.8.0;
contract Test { 
  function hello() public pure returns (string memory) { 
    return 'Hello, World!'; 
  } 
}`,
      contractName: "Test",
    },
    assertions: [
      { path: "abi", operator: "exists" },
      { path: "evm.bytecode.object", operator: "exists" },
      {
        path: "abi",
        operator: "length",
        value: 0,
        description: "ABI length > 0",
      },
      {
        path: "evm.bytecode.object",
        operator: "length",
        value: 0,
        description: "Bytecode length > 0",
      },
    ],
  },
  {
    version: "0.8.25",
    description: "Advanced contract with events, modifiers, and mappings",
    contract: {
      fileName: "advanced.sol",
      source: `pragma solidity ^0.8.25;

contract Advanced {
    uint256 public constant VALUE = 42;
    mapping(address => uint256) public balances;
    
    event ValueRead(uint256 value);
    event BalanceUpdated(address indexed user, uint256 newBalance);
    
    modifier onlyPositive(uint256 amount) {
        require(amount > 0, "Amount must be positive");
        _;
    }
    
    function readValue() public pure returns (uint256) {
        return VALUE;
    }
    
    function updateBalance(uint256 amount) public onlyPositive(amount) {
        balances[msg.sender] = amount;
        emit BalanceUpdated(msg.sender, amount);
    }
}`,
      contractName: "Advanced",
    },
    compilerSettings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
    assertions: [
      { path: "abi", operator: "exists" },
      { path: "evm.bytecode.object", operator: "exists" },
      {
        path: "abi",
        operator: "length",
        value: 6,
        description: "ABI has multiple entries",
      },
      {
        path: "evm.bytecode.object",
        operator: "length",
        value: 500,
        description: "Optimized bytecode still substantial",
      },
    ],
  },
  {
    version: "0.4.26",
    description: "Old version with constructor keyword",
    contract: {
      fileName: "old.sol",
      source: `pragma solidity ^0.4.26;

contract OldContract {
    uint256 public value;
    
    constructor() public {
        value = 42;
    }
    
    function setValue(uint256 _value) public {
        value = _value;
    }
    
    function getValue() public view returns (uint256) {
        return value;
    }
}`,
      contractName: "OldContract",
    },
    assertions: [
      { path: "abi", operator: "exists" },
      { path: "evm.bytecode.object", operator: "exists" },
      {
        path: "abi",
        operator: "length",
        value: 4,
        description: "Has constructor and functions",
      },
      {
        path: "evm.bytecode.object",
        operator: "length",
        value: 100,
        description: "Has bytecode",
      },
    ],
  },
  {
    version: "0.4.18",
    skip: true,
    description: "Legacy version with function-named constructor",
    contract: {
      fileName: "legacy.sol",
      source: `pragma solidity ^0.4.18;

contract LegacyContract {
    uint256 public counter;
    
    function LegacyContract() public {
        counter = 0;
    }
    
    function increment() public {
        counter = counter + 1;
    }
    
    function getCounter() public view returns (uint256) {
        return counter;
    }
}`,
      contractName: "LegacyContract",
    },
    assertions: [
      { path: "abi", operator: "exists" },
      { path: "evm.bytecode.object", operator: "exists" },
      {
        path: "abi",
        operator: "length",
        value: 2,
        description: "Has constructor and functions",
      },
      {
        path: "evm.bytecode.object",
        operator: "length",
        value: 100,
        description: "Has bytecode",
      },
    ],
  },
];

export const errorTestCase: TestCase = {
  version: "0.8.19",
  description: "Contract with syntax error",
  contract: {
    fileName: "error.sol",
    source: `pragma solidity ^0.8.0;

contract ErrorContract {
    function badFunction() public {
        uint256 x = ; // Syntax error
    }
}`,
    contractName: "ErrorContract",
  },
  assertions: [
    { path: "errors", operator: "exists" },
    {
      path: "errors",
      operator: "length",
      value: 0,
      description: "Has compilation errors",
    },
    {
      path: "errors[0].severity",
      operator: "equals",
      value: "error",
      description: "First error has error severity",
    },
    {
      path: "errors[0].message",
      operator: "contains",
      value: "Expected",
      description: "Error message contains 'Expected'",
    },
  ],
};

// Helper function to create compile input from test case
export function createCompileInput(testCase: TestCase): CompileInput {
  return {
    language: "Solidity",
    sources: {
      [testCase.contract.fileName]: {
        content: testCase.contract.source,
      },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["*"],
        },
      },
      ...(testCase.compilerSettings && {
        optimizer: testCase.compilerSettings.optimizer,
      }),
    },
  };
}

// Helper to evaluate a path in an object (simple JSONPath-like)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function evaluatePath(obj: any, path: string): any {
  // Handle JSONPath-like queries
  if (path.includes("[?(")) {
    const [basePath, query] = path.split("[?(");
    const base = basePath ? evaluatePath(obj, basePath) : obj;

    if (!Array.isArray(base)) return undefined;

    // Parse simple queries like @.type=='function'
    const match = query.match(/@\.(\w+)==['"]([^'"]+)['"]\]\s*$/);
    if (match) {
      const [, field, value] = match;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return base.filter((item: any) => item[field] === value);
    }

    // Parse compound queries like @.type=='function' && @.name=='LegacyContract'
    const andMatch = query.match(
      /@\.(\w+)==['"](.+)['"].*&&.*@\.(\w+)==['"](.+)['"]\]\s*$/
    );
    if (andMatch) {
      const [, field1, value1, field2, value2] = andMatch;
      return base.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => item[field1] === value1 && item[field2] === value2
      );
    }

    // Parse OR queries
    const orMatch = query.match(
      /@\.(\w+)==['"](.+)['"].*\|\|.*\(@\.(\w+)==['"](.+)['"].*@\.(\w+)==['"](.+)['"]\)\]\s*$/
    );
    if (orMatch) {
      const [, field1, value1, field2, value2, field3, value3] = orMatch;
      return base.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) =>
          item[field1] === value1 ||
          (item[field2] === value2 && item[field3] === value3)
      );
    }
  }

  // Handle simple dot notation
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current == null) return undefined;

    // Handle array index
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, field, index] = arrayMatch;
      current = current[field]?.[parseInt(index)];
    } else {
      current = current[part];
    }
  }

  return current;
}

// Helper to run assertions
export function runAssertions(
  contract: CompiledContract | CompileOutput,
  assertions: TestAssertion[]
): void {
  for (const assertion of assertions) {
    const actual = evaluatePath(contract, assertion.path);
    const description =
      assertion.description ||
      `${assertion.path} ${assertion.operator} ${assertion.value ?? ""}`;

    switch (assertion.operator) {
      case "exists":
        if (Array.isArray(actual)) {
          expect(actual.length, description).toBeGreaterThan(0);
        } else {
          expect(actual, description).toBeDefined();
        }
        break;
      case "equals":
        expect(actual, description).toBe(assertion.value);
        break;
      case "contains":
        expect(actual, description).toContain(assertion.value);
        break;
      case "length":
        if (typeof actual === "string") {
          expect(actual.length, description).toBeGreaterThan(
            assertion.value as number
          );
        } else if (Array.isArray(actual)) {
          if (assertion.value === 0) {
            expect(actual.length, description).toBeGreaterThan(0);
          } else {
            expect(actual.length, description).toBe(assertion.value);
          }
        }
        break;
      case "greaterThan":
        expect(actual, description).toBeGreaterThan(assertion.value as number);
        break;
    }
  }
}

// Helper to verify compilation output (for non-error cases)
export function verifyCompilationOutput(
  output: CompileOutput,
  fileName: string,
  contractName: string
): {
  contract: CompiledContract;
  errors?: Array<{ severity: string; message: string }>;
} {
  if (!output || typeof output !== "object") {
    throw new Error("Invalid output format");
  }

  let errors;
  if (output.errors && output.errors.length > 0) {
    const criticalErrors = output.errors.filter((e) => e.severity === "error");
    if (criticalErrors.length > 0) {
      throw new Error("Compilation errors: " + JSON.stringify(criticalErrors));
    }
    errors = output.errors;
  }

  const contract = output.contracts?.[fileName]?.[
    contractName
  ] as CompiledContract;
  if (!contract) {
    throw new Error("Contract not found in output");
  }

  return { contract, errors };
}

// Browser-specific test runner factory
export function createBrowserTestRunner(testName: string, testCase: TestCase) {
  return `
    window.${testName} = async (soljsonText) => {
      try {
        const solc = window.loadSolc(soljsonText);
        
        const input = ${JSON.stringify(createCompileInput(testCase))};
        
        const output = await solc.compile(input);
        solc.stopWorker();
        
        // For error test cases
        if (${testCase === errorTestCase}) {
          return {
            success: true,
            output: output
          };
        }
        
        // For normal test cases
        const { contract: compiledContract } = ${verifyCompilationOutput.toString()}(
          output, 
          "${testCase.contract.fileName}", 
          "${testCase.contract.contractName}"
        );
        
        return {
          success: true,
          contract: compiledContract
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || String(error)
        };
      }
    };
  `;
}
