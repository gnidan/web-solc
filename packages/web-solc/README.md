# web-solc

[![npm version](https://img.shields.io/npm/v/web-solc)](https://www.npmjs.com/package/web-solc)
[![Browser Support](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/gnidan/web-solc/main/browser-compatibility-badge.json&query=$.message&label=browser%20support&color=brightgreen)](https://github.com/gnidan/web-solc/blob/main/COMPATIBILITY.md)
[![Node.js Support](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/gnidan/web-solc/main/node-compatibility-badge.json&query=$.message&label=node.js%20support&color=brightgreen)](https://github.com/gnidan/web-solc/blob/main/COMPATIBILITY.md)

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

web-solc supports a wide range of Solidity compiler versions. For detailed compatibility information, see the [compatibility report](https://github.com/gnidan/web-solc/blob/main/COMPATIBILITY.md).

### Quick Summary

- **Full support (Browser & Node.js)**: 0.4.26, 0.5.3-0.5.6, 0.5.14-0.8.30
- **Node.js only**: 0.4.11-0.5.2, 0.5.7-0.5.13 (browser stack overflow issues)
- **Not supported**: < 0.4.11 (no Standard JSON support)

### Known Limitations

Many 0.4.x and 0.5.x versions fail in browser environments due to stack overflow errors when loading the large compiler JavaScript files. These versions work correctly in Node.js environments where memory constraints are less restrictive.

For best compatibility in browser environments, use Solidity versions 0.5.14 or newer.
