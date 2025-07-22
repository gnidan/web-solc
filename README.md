# web-solc monorepo

This monorepo contains two packages that provide Solidity compilation
capabilities for web environments:

1. [web-solc](./packages/web-solc/README.md): A package for running specific versions of solc in the browser using web workers.
2. [@web-solc/react](./packages/react/README.md): React bindings around web-solc

## web-solc

[![npm version](https://img.shields.io/npm/v/web-solc)](https://www.npmjs.com/package/web-solc)
[![Browser Support](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/gnidan/web-solc/main/browser-compatibility-badge.json&query=$.message&label=browser%20support&color=brightgreen)](./COMPATIBILITY.md)
[![Node.js Support](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/gnidan/web-solc/main/node-compatibility-badge.json&query=$.message&label=node.js%20support&color=brightgreen)](./COMPATIBILITY.md)
[![Test Status](https://github.com/gnidan/web-solc/actions/workflows/test.yml/badge.svg)](https://github.com/gnidan/web-solc/actions/workflows/test.yml)

The `web-solc` package allows you to run specific versions of the Solidity
compiler (solc) in the browser using web workers. It supports arbitrary
Solidity compilation using the
[Compiler Input and Output JSON](https://docs.soliditylang.org/en/latest/using-the-compiler.html#compiler-input-and-output-json-description)
format.

### Usage

```typescript
import { fetchSolc } from "web-solc";

const { compile, stopWorker } = await fetchSolc("^0.8.25");

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

// Don't forget to cleanup the running Worker when done
stopWorker();
```

For more details, see the [web-solc README](./packages/web-solc/README.md).

## @web-solc/react

[![npm version](https://img.shields.io/npm/v/%40web-solc%2Freact)](https://www.npmjs.com/package/@web-solc/react)

The `@web-solc/react` package provides React bindings for using the Solidity
compiler in browser environments. It offers a `useWebSolc()` hook and a
`<WebSolcProvider>` component for easy integration with React
applications.

### Usage

```tsx
import { WebSolcProvider, useWebSolc } from "@web-solc/react";
import type { CompilerInput, CompilerOutput } from "web-solc";

function App() {
  return (
    <WebSolcProvider>
      <CompilationComponent />
    </WebSolcProvider>
  );
}

function CompilationComponent({
  compilerInput,
}: {
  compilerInput: CompilerInput;
}) {
  const solc = useWebSolc("^0.8.25");

  if (!solc) {
    return <>Loading solc...</>;
  }

  const compile = async () => {
    try {
      const output: CompilerOutput = await solc.compile(compilerInput);
      console.log("Compilation output:", output);
    } catch (error) {
      console.error("Compilation error:", error);
    }
  };

  return <button onClick={compile}>Compile</button>;
}
```

For more details, see the [@web-solc/react README](./packages/react/README.md).

## Example Vite App

This repository includes a sample webapp that demonstrates Solidity compilation
inside the browser. You can find it in the
[`./packages/example/`](./packages/example/) directory.

## Installation

To use these packages in your project, you can install them via npm:

```console
npm install --save web-solc @web-solc/react
```

## Solidity Version Compatibility

web-solc supports a wide range of Solidity compiler versions. For detailed compatibility information, see the [compatibility report](./COMPATIBILITY.md).

### Quick Compatibility Summary:

- **Browser Support**: 0.4.26+ (with gaps in 0.4.x and 0.5.x ranges)
- **Node.js Support**: 0.4.16+
- **Not supported**: < 0.4.16 (limited Standard JSON support)

### Testing Compatibility

To test specific Solidity versions locally:

```bash
# Download all compiler versions
yarn test:compat:download

# Run integration tests (tests representative versions by default)
cd packages/web-solc && yarn test:integration

# Run ALL version tests (takes longer)
yarn test:compat

# Generate compatibility report
yarn test:compat:report

# Commit the updated files
git add COMPATIBILITY.md *-badge.json
git commit -m "Update compatibility report and badges"
```

**Note**: The compatibility report and badges are tracked in git. When making changes that affect compatibility, please regenerate and commit these files. CI will validate they're up-to-date.

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE)
file for details.
