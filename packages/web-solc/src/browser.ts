import { fetchLatestReleasedSoljsonSatisfyingVersionRange } from "./common.js";

import type { FetchSolcOptions, WebSolc } from "./interface.js";
import solcWorker from "./solc.worker.js";

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

export function loadSolc(soljsonText: string): WebSolc {
  const { worker, stopWorker } = startWorker();

  return {
    compile(input) {
      return new Promise((accept, reject) => {
        worker.onmessage = (event) => {
          try {
            accept(event.data);
          } catch (error) {
            reject(error);
          }
        };

        worker.onerror = reject;

        worker.postMessage({ soljsonText, input });
      });
    },

    stopWorker,
  };
}

function startWorker(): {
  worker: Worker;
  stopWorker: () => void;
} {
  const workerBlob = new Blob([`(${solcWorker.toString()})()`], {
    type: "application/javascript",
  });
  const workerUrl = URL.createObjectURL(workerBlob);
  const worker = new Worker(workerUrl);

  return {
    worker,
    stopWorker: () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    },
  };
}
