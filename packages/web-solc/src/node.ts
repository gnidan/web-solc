import * as path from "path";

import type {
  FetchAndLoadOptions,
  WebSolc,
  LoadOptions,
  CompilerInterface,
} from "./interface.js";
import type { WorkerSolc } from "./solc.worker.js";
import { fetchSolc } from "./common.js";

export * from "./interface.js";
export { fetchSolc, resolveSolc } from "./common.js";

export async function fetchAndLoadSolc(
  versionRange: string,
  options?: FetchAndLoadOptions
): Promise<WebSolc> {
  const soljson = options?.fetch
    ? await fetchSolc(versionRange, options.fetch)
    : await fetchSolc(versionRange);
  return loadSolc(soljson, options?.load);
}

export async function loadSolc(
  soljson: string,
  options?: LoadOptions
): Promise<WebSolc> {
  const solc = await loadSoljson(soljson, options);

  return {
    compile(input) {
      return JSON.parse(solc.compile(JSON.stringify(input)));
    },

    stopWorker() {
      /* this implementation does not use a worker */
    },
  };
}

async function loadSoljson(
  soljson: string,
  options?: LoadOptions
): Promise<WorkerSolc> {
  // Apply compatibility options
  const disabledInterfaces =
    options?.compatibility?.disableCompilerInterfaces ?? [];

  const baseModule: Record<string, unknown> = {
    wasmBinary: null,
  };

  const Module = new Proxy(baseModule, {
    get(target, prop) {
      if (prop === "__dirname") {
        return process.cwd();
      }
      return target[prop as string];
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  });

  const context = {
    Module,
    process,
    __dirname: process.cwd(),
    __filename: path.join(process.cwd(), "solc.js"),
    // For compatibility with older Solidity versions
    print: console.log,
    printErr: console.error,
  };

  const soljsonFunction = new Function(...Object.keys(context), soljson);
  await soljsonFunction(...Object.values(context));

  // Wait for the module to be fully initialized
  if (typeof Module.onRuntimeInitialized === "function") {
    await new Promise<void>((resolve) => {
      Module.onRuntimeInitialized = resolve;
    });
  }

  if (typeof Module.cwrap !== "function") {
    throw new Error(
      "Module.cwrap is not a function. The Solidity compiler may not have initialized correctly."
    );
  }

  // Helper to check if an interface is disabled
  const isDisabled = (interfaceName: CompilerInterface) =>
    disabledInterfaces.includes(interfaceName);

  // Try different compiler APIs in order of preference
  let compile: ((input: string) => string) | undefined;

  // For newer versions, check underscore-prefixed exports first
  if (Module["_solidity_compile"] && !isDisabled("modern")) {
    // Modern API (0.5.0+) - check if it actually works
    try {
      const solidity_compile = Module.cwrap("solidity_compile", "string", [
        "string",
        "number",
      ]);
      compile = (input: string) => solidity_compile(input, 0);
    } catch {
      // If solidity_compile doesn't work, try with underscore
      const solidity_compile = Module.cwrap("_solidity_compile", "string", [
        "string",
        "number",
      ]);
      compile = (input: string) => solidity_compile(input, 0);
    }
  }

  if (!compile) {
    // Legacy API for 0.4.x versions
    if (!compile && !isDisabled("legacy")) {
      try {
        compile = Module.cwrap("compileStandard", "string", ["string"]);
      } catch {
        // Continue to next
      }
    }

    // Last resort: try modern API without checking exports
    if (!compile && !isDisabled("modern")) {
      try {
        const solidity_compile = Module.cwrap("solidity_compile", "string", [
          "string",
          "number",
        ]);
        compile = (input: string) => solidity_compile(input, 0);
      } catch {
        // Give up
      }
    }
  }

  if (!compile) {
    throw new Error(
      "No compatible Solidity compiler API found or all APIs disabled. Available exports: " +
        Object.keys(Module)
          .filter((k) => k.startsWith("_"))
          .join(", ")
    );
  }

  return { compile };
}
