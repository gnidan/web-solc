import type { CompilerInput, CompilerOutput } from "./common.js";

export interface WorkerSolc {
  compile(input: string): string;
}

export default function solcWorker() {
  self.onmessage = async (event: MessageEvent) => {
    const { soljsonText, input } = event.data;

    const solc = await loadSolc(soljsonText);

    const output = JSON.parse(
      solc.compile(
        JSON.stringify(input)
      )
    );

    self.postMessage(output);
  }

  async function loadSolc(soljsonText: string): Promise<WorkerSolc> {
    const Module = { exports: {} };

    const soljsonFunction = new Function("Module", soljsonText);
    soljsonFunction(Module);

    const compile = (Module as any).cwrap(
      "solidity_compile",
      "string",
      ["string", "number"]
    );

    const solc = { compile };

    return solc;
  }
};
