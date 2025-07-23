# web-solc monorepo

[![npm version](https://img.shields.io/npm/v/web-solc?label=web-solc)](https://www.npmjs.com/package/web-solc)
[![npm version](https://img.shields.io/npm/v/@web-solc/react?label=@web-solc/react)](https://www.npmjs.com/package/@web-solc/react)
[![Test Status](https://github.com/gnidan/web-solc/actions/workflows/test.yml/badge.svg)](https://github.com/gnidan/web-solc/actions/workflows/test.yml)
[![solc support (browser)](<https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/gnidan/web-solc/main/browser-compatibility-badge.json&query=$.message&label=solc%20support%20(browser)&color=brightgreen>)](./COMPATIBILITY.md)
[![solc support (Node.js)](<https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/gnidan/web-solc/main/node-compatibility-badge.json&query=$.message&label=solc%20support%20(Node.js)&color=brightgreen>)](./COMPATIBILITY.md)

Load and run Solidity compilers in browsers and Node.js.

This monorepo contains:

- **[web-solc](./packages/web-solc/README.md)** - Core library for loading and running Solidity compilers
- **[@web-solc/react](./packages/react/README.md)** - React bindings with hooks for Solidity compilation
- **[Example app](./packages/example/)** - Demo Vite application

## Getting Started

### Installation

```console
# Core library
npm install --save web-solc

# React bindings (includes web-solc)
npm install --save @web-solc/react
```

### Using web-solc

The `web-solc` package lets you run Solidity compilers in any JavaScript environment.
It works in browsers using Web Workers for better performance and compatibility, and
runs natively in Node.js. You have full control over how you source and cache your
compiler versions.

```typescript
import { fetchAndLoadSolc } from "web-solc";

// Fetch and load a compiler
const solc = await fetchAndLoadSolc("^0.8.26");

// Compile your contracts
const output = await solc.compile({
  language: "Solidity",
  sources: {
    "Contract.sol": {
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

// Clean up when done
solc.stopWorker();
```

See the [web-solc README](./packages/web-solc/README.md) for more control over compiler loading and caching.

### Using @web-solc/react

The `@web-solc/react` package provides React bindings for web-solc with a
modern hook-based API. The `useWebSolc` hook works standalone or with an
optional provider for caching compilers across components.

```tsx
import { useWebSolc } from "@web-solc/react";

function CompilerComponent() {
  // Automatically fetch latest version matching specified range
  const compiler = useWebSolc({ version: "^0.8.25" });

  if (compiler.loading) return <div>Loading compiler...</div>;
  if (compiler.error) return <div>Error: {compiler.error.message}</div>;

  const handleCompile = async () => {
    const output = await compiler.compile({
      language: "Solidity",
      sources: {
        "Contract.sol": {
          content: "pragma solidity ^0.8.0; contract Test {}",
        },
      },
    });
    console.log("Compilation output:", output);
  };

  return <button onClick={handleCompile}>Compile</button>;
}
```

The hook automatically handles cleanup when components unmount. For advanced
usage including compiler caching and custom CDN configuration, see the
[@web-solc/react README](./packages/react/README.md).

## Solidity version compatibility

web-solc supports a wide range of Solidity compiler versions. For detailed compatibility information, see the [compatibility report](./COMPATIBILITY.md).

### Compatibility summary

- **Browser Support**: 0.4.26+ (with gaps in 0.4.x and 0.5.x ranges)
- **Node.js Support**: 0.4.16+
- **Not supported**: < 0.4.16 (limited Standard JSON support)

### Generating compatibility report locally

To test specific Solidity versions locally:

```bash
# Download all compiler versions
yarn test:compat:download
yarn test:compat:report
```

**Note**: The compatibility report and badges are tracked in git. When making changes that affect compatibility, please regenerate and commit these files. CI will validate they're up-to-date.

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE)
file for details.
