export interface WorkerSolc {
  compile(input: string): string;
}

interface EmscriptenModule {
  exports: Record<string, unknown>;
  print: typeof console.log;
  printErr: typeof console.error;
  noInitialRun: boolean;
  noExitRuntime: boolean;
  onRuntimeInitialized?: () => void;
  cwrap?: (
    name: string,
    returnType: string,
    argTypes: string[]
  ) => (...args: unknown[]) => string;
  _compileStandard?: unknown;
  _compileJSONMulti?: unknown;
  _compileJSON?: unknown;
}

import type { LegacyInterface } from "./interface.js";

export default function solcWorker() {
  self.onmessage = async (event: MessageEvent) => {
    try {
      const { soljsonUrl, input, disabledInterfaces = [] } = event.data;

      const solc = await loadSolcFromUrl(soljsonUrl, disabledInterfaces);

      const output = JSON.parse(solc.compile(JSON.stringify(input)));

      self.postMessage(output);
    } catch (error) {
      // Send error back to main thread
      self.postMessage({
        errors: [
          {
            type: "Error",
            component: "general",
            severity: "error",
            message: error instanceof Error ? error.message : String(error),
            formattedMessage:
              error instanceof Error
                ? error.stack || error.message
                : String(error),
          },
        ],
      });
    }
  };

  async function loadSolcFromUrl(
    soljsonUrl: string,
    disabledInterfaces: LegacyInterface[]
  ): Promise<WorkerSolc> {
    // Use importScripts to load the soljson from blob URL
    const Module: EmscriptenModule = {
      exports: {},
      print: console.log,
      printErr: console.error,
      noInitialRun: true,
      noExitRuntime: true,
    } as EmscriptenModule & Record<string, unknown>;

    // Make Module globally available for the imported script
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).Module = Module;

    // Try to import the script directly
    importScripts(soljsonUrl);

    // Module is now loaded and ready

    // Wait for the module to be fully initialized
    if (typeof Module.onRuntimeInitialized === "function") {
      await new Promise<void>((resolve) => {
        const originalCallback = Module.onRuntimeInitialized;
        Module.onRuntimeInitialized = () => {
          if (originalCallback) originalCallback();
          resolve();
        };
      });
    }

    // Check if cwrap is available
    if (!Module.cwrap) {
      throw new Error(
        "Module.cwrap is not available. The compiler may not have loaded correctly."
      );
    }

    const ModuleTyped = Module as unknown as {
      cwrap: (
        name: string,
        returnType: string,
        argTypes: string[]
      ) => (...args: unknown[]) => string;
    };

    // Try different compiler APIs in order of preference
    let compile: ((input: string) => string) | undefined;

    // Helper to check if an interface is disabled
    const isDisabled = (interfaceName: LegacyInterface) =>
      disabledInterfaces.includes(interfaceName);

    // For 0.4.x versions, check for underscore-prefixed exports but cwrap without underscore
    const ModuleWithFuncs = Module as EmscriptenModule &
      Record<string, unknown>;

    // Try compile APIs in order of preference based on what's available
    if (
      (Module._compileStandard || ModuleWithFuncs.compileStandard) &&
      !isDisabled("compile-standard")
    ) {
      compile = ModuleTyped.cwrap("compileStandard", "string", ["string"]);
    } else if (Module._compileJSONMulti && !isDisabled("compile-json-multi")) {
      const compileMulti = ModuleTyped.cwrap("compileJSONMulti", "string", [
        "string",
        "string",
        "number",
      ]);
      compile = (input: string) => compileMulti(input, "", 0);
    } else if (Module._compileJSON && !isDisabled("compile-json")) {
      const compileJSON = ModuleTyped.cwrap("compileJSON", "string", [
        "string",
        "number",
      ]);
      compile = (input: string) => compileJSON(input, 1); // optimize=true
    } else {
      // Try modern APIs and fallbacks
      let found = false;

      // Try modern API
      if (!isDisabled("solidity-compile")) {
        try {
          const solidity_compile = ModuleTyped.cwrap(
            "solidity_compile",
            "string",
            ["string", "number"]
          );
          compile = (input: string) => solidity_compile(input, 0);
          found = true;
        } catch {
          // Continue to next
        }
      }

      // Try standard API
      if (!found && !isDisabled("compile-standard")) {
        try {
          compile = ModuleTyped.cwrap("compileStandard", "string", ["string"]);
          found = true;
        } catch {
          // Continue to next
        }
      }

      // Try multi-file API
      if (!found && !isDisabled("compile-json-multi")) {
        try {
          const compileMulti = ModuleTyped.cwrap("compileJSONMulti", "string", [
            "string",
            "string",
            "number",
          ]);
          compile = (input: string) => compileMulti(input, "", 0);
          found = true;
        } catch {
          // Continue to next
        }
      }

      // Try single-file API
      if (!found && !isDisabled("compile-json")) {
        const compileJSON = ModuleTyped.cwrap("compileJSON", "string", [
          "string",
          "number",
        ]);
        compile = (input: string) => compileJSON(input, 1); // optimize=true
      }
    }

    if (!compile) {
      throw new Error("No compatible compiler API found or all APIs disabled");
    }

    const solc = { compile };

    return solc;
  }
}
