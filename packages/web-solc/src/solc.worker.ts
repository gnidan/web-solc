export interface WorkerSolc {
  compile(input: string): string;
}

export default function solcWorker() {
  self.onmessage = async (event: MessageEvent) => {
    const { soljsonText, input } = event.data;

    const solc = await loadSolc(soljsonText);

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    self.postMessage(output);
  };

  async function loadSolc(soljsonText: string): Promise<WorkerSolc> {
    const Module = { exports: {} };

    const soljsonFunction = new Function("Module", soljsonText);
    soljsonFunction(Module);

    const compile = (
      Module as unknown as {
        cwrap: (
          name: string,
          returnType: string,
          argTypes: string[]
        ) => (input: string) => string;
      }
    ).cwrap("solidity_compile", "string", ["string", "number"]);

    const solc = { compile };

    return solc;
  }
}
