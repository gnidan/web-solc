# web-solc monorepo

This monorepo contains two packages that provide Solidity compilation
capabilities for web environments:

1. [web-solc](./packages/web-solc/README.md): A package for running specific versions of solc in the browser using web workers.
2. [@web-solc/react](./packages/react/README.md): React bindings around web-solc

## web-solc

[![npm version](https://img.shields.io/npm/v/web-solc)](https://www.npmjs.com/package/web-solc)

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

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE)
file for details.
