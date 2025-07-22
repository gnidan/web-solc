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

export default function solcWorker() {
  self.onmessage = async (event: MessageEvent) => {
    try {
      const { soljsonUrl, input } = event.data;

      const solc = await loadSolcFromUrl(soljsonUrl);

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

  async function loadSolcFromUrl(soljsonUrl: string): Promise<WorkerSolc> {
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

    try {
      // Try to import the script directly
      importScripts(soljsonUrl);
    } catch (error) {
      throw error;
    }

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
    let compile: (input: string) => string;

    // For 0.4.x versions, check for underscore-prefixed exports but cwrap without underscore
    const ModuleWithFuncs = Module as EmscriptenModule &
      Record<string, unknown>;
    if (Module._compileStandard || ModuleWithFuncs.compileStandard) {
      compile = ModuleTyped.cwrap("compileStandard", "string", ["string"]);
    } else if (Module._compileJSONMulti) {
      const compileMulti = ModuleTyped.cwrap("compileJSONMulti", "string", [
        "string",
        "string",
        "number",
      ]);
      compile = (input: string) => compileMulti(input, "", 0);
    } else if (Module._compileJSON) {
      const compileJSON = ModuleTyped.cwrap("compileJSON", "string", [
        "string",
        "number",
      ]);
      compile = (input: string) => compileJSON(input, 1); // optimize=true
    } else {
      // Try modern APIs
      try {
        const solidity_compile = ModuleTyped.cwrap(
          "solidity_compile",
          "string",
          ["string", "number"]
        );
        compile = (input: string) => solidity_compile(input, 0);
      } catch {
        try {
          compile = ModuleTyped.cwrap("compileStandard", "string", ["string"]);
        } catch {
          try {
            const compileMulti = ModuleTyped.cwrap(
              "compileJSONMulti",
              "string",
              ["string", "string", "number"]
            );
            compile = (input: string) => compileMulti(input, "", 0);
          } catch {
            const compileJSON = ModuleTyped.cwrap("compileJSON", "string", [
              "string",
              "number",
            ]);
            compile = (input: string) => compileJSON(input, 1); // optimize=true
          }
        }
      }
    }

    const solc = { compile };

    return solc;
  }
}
