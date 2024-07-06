const { default: webSolc } = await import("web-solc");

const solc = await webSolc("^0.8.25");

console.log("solc %o", solc);

const result = await solc.compile({
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
