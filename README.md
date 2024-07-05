# web-solc

The **web-solc** package provides the ability to run a specific version of solc
in the browser. This implementation uses web workers to avoid compatibility
issues.

## Installation

This assumes use of some kind of bundler like Vite or Next.js.

```console
npm install --save web-solc
```


## Usage

```typescript
import webSolc from "web-solc";

const solc = await webSolc("^0.8.25");

// note that this handles JSON stringifying/parsing automatically, instead of
// how solc-js accepts/returns JSON strings.
const { contracts } = await solc.compile({
  language: "Solidity",
  sources: {
    "test.sol": {
      content: "pragma solidity ^0.8.0; contract Test {}"
    }
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["*"]
      }
    }
  }
});
```
