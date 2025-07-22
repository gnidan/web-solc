import { expect } from "vitest";

// Types
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

// Helper to evaluate a path in an object (simple dot notation)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evaluatePath(obj: any, path: string): any {
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

        // Check if this is an error test case
        if (${!!testCase.assertions.find((a) => a.path === "errors")}) {
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
