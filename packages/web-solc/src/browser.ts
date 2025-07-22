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

  // Create a blob URL for the soljson
  const soljsonBlob = new Blob([soljsonText], {
    type: "application/javascript",
  });
  const soljsonUrl = URL.createObjectURL(soljsonBlob);

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

        worker.postMessage({ soljsonUrl, input });
      });
    },

    stopWorker: () => {
      stopWorker();
      URL.revokeObjectURL(soljsonUrl);
    },
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
