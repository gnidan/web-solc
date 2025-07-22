import * as path from "path";

import type { FetchSolcOptions, WebSolc } from "./interface.js";
import type { WorkerSolc } from "./solc.worker.js";
import { fetchLatestReleasedSoljsonSatisfyingVersionRange } from "./common.js";

export * from "./interface.js";

export async function fetchSolc(
  versionRange: string,
  options?: FetchSolcOptions
): Promise<WebSolc> {
  const soljsonText = await fetchLatestReleasedSoljsonSatisfyingVersionRange(
    versionRange,
    options
  );

  return loadSolc(soljsonText);
}

export async function loadSolc(soljsonText: string): Promise<WebSolc> {
  const solc = await loadSoljson(soljsonText);

  return {
    compile(input) {
      return JSON.parse(solc.compile(JSON.stringify(input)));
    },

    stopWorker() {
      /* this implementation does not use a worker */
    },
  };
}

async function loadSoljson(soljsonText: string): Promise<WorkerSolc> {
  // Patch Solidity versions 0.4.0 through 0.4.25 that have getCFunc lookup issues
  // These versions export functions without underscore prefix but getCFunc looks for them with underscore
  // This specific string pattern was identified through testing all compiler versions
  // Note: This string replacement is fragile but necessary - the exact pattern appears consistently
  // in affected versions. Version 0.4.26+ fixed this issue upstream.
  if (
    soljsonText.includes("getCFunc") &&
    soljsonText.includes('Module["_"+ident]')
  ) {
    // Replace getCFunc to look for both with and without underscore
    soljsonText = soljsonText.replace(
      'var func=Module["_"+ident];assert(func,"Cannot call unknown function "+ident',
      'var func=Module["_"+ident]||Module[ident];assert(func,"Cannot call unknown function "+ident'
    );
  }

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

  const soljsonFunction = new Function(...Object.keys(context), soljsonText);
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

  // Try different compiler APIs in order of preference
  let compile: (input: string) => string;

  // For newer versions, check underscore-prefixed exports first
  if (Module["_solidity_compile"]) {
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
  } else {
    // For older versions, try the APIs in order without underscores first
    try {
      // Standard JSON API (0.4.11+)
      compile = Module.cwrap("compileStandard", "string", ["string"]);
    } catch {
      try {
        // Legacy multi-file API
        const compileMulti = Module.cwrap("compileJSONMulti", "string", [
          "string",
          "string",
          "number",
        ]);
        compile = (input: string) => compileMulti(input, "", 0);
      } catch {
        try {
          // Oldest single-file API
          const compileJSON = Module.cwrap("compileJSON", "string", [
            "string",
            "number",
          ]);
          compile = (input: string) => compileJSON(input, 1); // optimize=true
        } catch {
          // Last resort: try modern API without checking exports
          try {
            const solidity_compile = Module.cwrap(
              "solidity_compile",
              "string",
              ["string", "number"]
            );
            compile = (input: string) => solidity_compile(input, 0);
          } catch {
            throw new Error(
              "No compatible Solidity compiler API found. Available exports: " +
                Object.keys(Module)
                  .filter((k) => k.startsWith("_"))
                  .join(", ")
            );
          }
        }
      }
    }
  }

  return { compile };
}
