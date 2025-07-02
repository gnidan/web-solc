# web-solc

[![npm version](https://img.shields.io/npm/v/web-solc)](https://www.npmjs.com/package/web-solc)

The **web-solc** package provides the ability to run a specific version of solc
in the browser. This implementation uses web workers to avoid compatibility
issues.

This package allows arbitrary Solidity compilation using the
[Compiler Input and Output JSON](https://docs.soliditylang.org/en/latest/using-the-compiler.html#compiler-input-and-output-json-description)
format that Solidity defines.

This package also provides Node.js compatibility with no change in usage.

## Installation

This assumes use of some kind of bundler like Vite or Next.js.

```console
npm install --save web-solc
```

## Usage

```typescript
// or via `const { fetchSolc } = await import("web-solc");`
import { fetchSolc } from "web-solc";

const { compile, stopWorker } = await fetchSolc("^0.8.25");

// note that this handles JSON stringifying/parsing automatically, instead of
// how solc-js accepts/returns JSON strings.
const { contracts } = await compile({
  language: "Solidity",
  sources: {
    "test.sol": {
      content: "pragma solidity ^0.8.0; contract Test {}",
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["*"],
      },
    },
  },
});

// later, don't forget to cleanup the running Worker
stopWorker();
```
