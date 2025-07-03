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

## Version Compatibility

web-solc supports multiple versions of the Solidity compiler by detecting and using the appropriate API:

- **Modern versions (0.5.0+)**: Uses the `solidity_compile` API
- **Standard JSON versions (0.4.11+)**: Uses the `compileStandard` API
- **Legacy versions (0.4.0-0.4.10)**: Uses `compileJSONMulti` or `compileJSON` APIs

The package automatically detects which API is available in the loaded compiler and uses it transparently.

### Known Limitations

Some very old compiler versions have compatibility issues:

- **Large compiler files (e.g., 0.4.18)** may exceed browser stack size limits due to `new Function()` constraints
- **0.4.x versions** required special patching to work in browser environments, which has been implemented for versions like 0.4.26
- 0.4.x versions work correctly in Node.js environments
- Very old versions (< 0.4.11) may not support Standard JSON input/output format

For best compatibility, use Solidity versions 0.5.0 or newer. However, many 0.4.x versions are now supported with automatic compatibility patches.
