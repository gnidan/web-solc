const { fetchSolc } = await import("web-solc");

const { compile, stopWorker } = await fetchSolc("^0.8.25");

const result = await compile({
  language: "Solidity",
  sources: {
    "test.sol": {
      content: "pragma solidity ^0.8.0; contract Test {}"
    }
  },
  settings: {
    viaIR: true,
    outputSelection: {
      "*": {
        "*": ["*"]
      }
    }
  }
});

console.log("result %o", result);

stopWorker();
