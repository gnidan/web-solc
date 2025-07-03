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

  const compile = Module.cwrap("solidity_compile", "string", [
    "string",
    "number",
  ]);

  return { compile };
}
