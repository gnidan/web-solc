# @web-solc/react

[![npm version](https://img.shields.io/npm/v/%40web-solc%2Freact)](https://www.npmjs.com/package/@web-solc/react)

This package provides React bindings for using the Solidity compiler (`solc`)
in browser environments.

## Installation

```console
npm install --save @web-solc/react
```

or

```console
yarn add @web-solc/react
```

## Usage

### `useWebSolc()` hook

The `useWebSolc(versionRange: string)` hook provides a straightforward method
for fetching and running the Solidity compiler client-side within a React
application.

This hook fetches the list of Solidity compiler versions and fetches the
latest release that satisfies the [semantic versioning](https://semver.org)
constraints specified by `versionRange`.

This hook relies on the use of a shared pool that must be instantiated via the
`<WebSolcProvider>` component, this package's other main export.

```tsx
import { useState } from "react";

import type { CompilerInput, CompilerOutput } from "web-solc";

import { useWebSolc } from "@web-solc/react";

export interface Props {
  compilerInput: CompilerInput;
}

export default function MyComponent({ compilerInput }) {
  const solc = useWebSolc("^0.8.25");
  if (!solc) {
    return <>Loading solc...</>;
  }

  const [compilation, setCompilation] = useState<CompilerOutput | undefined>();

  const compile = async () => {
    try {
      setCompilation(await solc.compile(compilerInput));
    } catch (error) {
      console.error("Compilation error: ", error);
    }
  };

  return (
    <div>
      <button onClick={compile}>Compile</button>
      {compilation && <pre>{JSON.stringify(compilation, null, 2)}</pre>}
    </div>
  );
}
```

### `<WebSolcProvider>` component

Because solc-js only runs in the browser inside a Web Worker, it becomes
necessary to handle stopping these when they are no longer needed.

This is handled via the use of the `<WebSolcProvider>` component, whose
behavior includes performing the necessary cleanup when _it_ unmounts.

This component **must** wrap any children or other descendent components in
order for their being able to access the `useWebSolc()` hook.

```tsx
import { WebSolcProvider } from "@web-solc/react";

export default function App() {
  return (
    // ... other context providers
    <WebSolcProvider>{/* ... children */}</WebSolcProvider>
  );
}
```

#### Customizing compiler source repository

The **web-solc** allows customizing the base URL for obtaining the list of
available compiler versions and the compiler emscripten binaries themselves.
It is possible to specify a mirror via the `repository` prop:

```tsx
import { WebSolcProvider } from "@web-solc/react";

export default function App() {
  return (
    <WebSolcProvider repository={{ baseUrl: "https://custom.solc.builds" }}>
      {/* ... children */}
    </WebSolcProvider>
  );
}
```
