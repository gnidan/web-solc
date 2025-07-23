# web-solc

[![npm version](https://img.shields.io/npm/v/web-solc)](https://www.npmjs.com/package/web-solc)
[![solc support (browser)](<https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/gnidan/web-solc/main/browser-compatibility-badge.json&query=$.message&label=solc%20support%20(browser)&color=brightgreen>)](./COMPATIBILITY.md)
[![solc support (Node.js)](<https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/gnidan/web-solc/main/node-compatibility-badge.json&query=$.message&label=solc%20support%20(Node.js)&color=brightgreen>)](./COMPATIBILITY.md)

Load and run Solidity compilers in browser and Node.js environments.

This package provides a flexible system for loading and executing Solidity compilers
in any JavaScript environment. In browsers, compilation runs inside a Web Worker to avoid
blocking the main thread (and because this is the only way it works). In Node.js, compilers run natively with minimal overhead.

## Installation

```bash
npm install --save web-solc
```

## Quick start

```javascript
import { fetchAndLoadSolc } from "web-solc";

// Fetch and load a compiler in one step
const solc = await fetchAndLoadSolc("^0.8.0");

// Compile your contracts
const output = await solc.compile({
  language: "Solidity",
  sources: {
    "Contract.sol": {
      content: "pragma solidity ^0.8.0; contract MyContract { }",
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

// Clean up (important in browsers to terminate the Worker)
solc.stopWorker();
```

## Core concepts

This library separates compiler fetching from loading, giving you full control over
how compilers are sourced, cached, and instantiated:

1. **Fetch**: Get the compiler JavaScript (from CDN, cache, filesystem, etc.)
2. **Load**: Create a working compiler instance from that JavaScript
3. **Compile**: Use the instance to compile your Solidity code

```javascript
import { fetchSolc, loadSolc } from "web-solc";

// Step 1: Fetch compiler JavaScript (a string)
const soljson = await fetchSolc("^0.8.26");

// Step 2: Create compiler instance
const solc = await loadSolc(soljson);

// Step 3: Compile
const output = await solc.compile(/* ... */);
```

This separation enables usage patterns like caching, offline usage, and custom
compiler sources.

## API reference

### Primary functions

<details>
<summary><code>fetchAndLoadSolc(versionRange, options?)</code> — Fetch and load compiler in one step</summary>

```typescript
function fetchAndLoadSolc(
  versionRange: string,
  options?: FetchAndLoadOptions
): Promise<WebSolc>;
```

The simplest way to get a working compiler. Combines `fetchSolc` and `loadSolc` for convenience.

**Parameters:**

- `versionRange` — Semantic version range (`"^0.8.0"`, `"0.8.26"`, `"latest"`)
- `options.fetch` — Repository configuration (optional)
- `options.load` — Compiler loading options (optional)

**Example:**

```javascript
const solc = await fetchAndLoadSolc("^0.8.0");
const output = await solc.compile(input);
solc.stopWorker();
```

</details>

<details>
<summary><code>fetchSolc(versionRange, options?)</code> — Download compiler JavaScript</summary>

```typescript
function fetchSolc(
  versionRange: string,
  options?: FetchOptions
): Promise<string>;
```

Downloads the compiler JavaScript from binaries.soliditylang.org.

**Parameters:**

- `versionRange` — Semantic version range for selecting compiler
- `options.repository.baseUrl` — Alternative CDN URL (optional)

**Returns:** Compiler JavaScript as a string

**Example:**

```javascript
const soljson = await fetchSolc("0.8.26");
// Store it, cache it, or load it immediately
localStorage.setItem("solc-0.8.26", soljson);
```

</details>

<details>
<summary><code>resolveSolc(versionRange, options?)</code> — Resolve version range to exact version</summary>

```typescript
function resolveSolc(
  versionRange: string,
  options?: FetchOptions
): Promise<{ version: string; path: string }>;
```

Resolves a semantic version range to the exact compiler version and path, without downloading the compiler.

**Parameters:**

- `versionRange` — Semantic version range for selecting compiler
- `options.repository.baseUrl` — Alternative CDN URL (optional)

**Returns:** Object with exact `version` and `path`

**Example:**

```javascript
const { version, path } = await resolveSolc("^0.8.0");
console.log(version); // "0.8.26"
console.log(path); // "soljson-v0.8.26+commit.8a97fa7a.js"

// Useful for checking what version would be downloaded
const latest = await resolveSolc("latest");
console.log(`Latest version is ${latest.version}`);
```

</details>

<details>
<summary><code>loadSolc(soljson, options?)</code> — Create compiler instance</summary>

```typescript
function loadSolc(soljson: string, options?: LoadOptions): Promise<WebSolc>;
```

Creates a working compiler instance from JavaScript source.

**Parameters:**

- `soljson` — The compiler JavaScript as a string
- `options` — Advanced configuration (rarely needed)

**Returns:** WebSolc instance ready to compile

**Example:**

```javascript
// From any source: CDN, filesystem, cache, etc.
const soljson = await getCompilerSomehow();
const solc = await loadSolc(soljson);
```

</details>

### WebSolc instance

<details>
<summary><code>compile(input)</code> — Compile Solidity code</summary>

```typescript
compile(input: CompilerInput): Promise<CompilerOutput>
```

**Example:**

```javascript
const output = await solc.compile({
  language: "Solidity",
  sources: {
    "Contract.sol": {
      content: "pragma solidity ^0.8.0; contract C { }",
    },
  },
  settings: {
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode"] },
    },
  },
});
```

</details>

<details>
<summary><code>stopWorker()</code> — Clean up resources</summary>

```typescript
stopWorker(): void
```

**Important:** Always call this when done, especially in browsers where it terminates the Web Worker.

```javascript
try {
  const output = await solc.compile(input);
  // Use output...
} finally {
  solc.stopWorker();
}
```

</details>

### Compiler input/output

The `compile` method uses Solidity's [Compiler Input and Output JSON format](https://docs.soliditylang.org/en/latest/using-the-compiler.html#compiler-input-and-output-json-description):

```javascript
const input = {
  language: "Solidity",
  sources: {
    "MyContract.sol": {
      content: "pragma solidity ^0.8.0; contract MyContract { }",
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode"],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

const output = await solc.compile(input);

// Check for errors
if (output.errors?.some((e) => e.severity === "error")) {
  console.error("Compilation failed:", output.errors);
}

// Access compiled contracts
const contract = output.contracts["MyContract.sol"]["MyContract"];
console.log(contract.abi);
console.log(contract.evm.bytecode.object);
```

## Common patterns

### Caching compilers

```javascript
import { fetchSolc, loadSolc } from "web-solc";

const compilerCache = new Map();

async function getCompiler(version) {
  if (!compilerCache.has(version)) {
    const soljson = await fetchSolc(version);
    compilerCache.set(version, await loadSolc(soljson));
  }
  return compilerCache.get(version);
}
```

### Version resolution

```javascript
import { resolveSolc, fetchSolc, loadSolc } from "web-solc";

// Check what version a range resolves to
const { version } = await resolveSolc("^0.8.0");
console.log(`Will use Solidity ${version}`);

// Cache by exact version, not range
const versionCache = new Map();

async function getCompilerForRange(range) {
  const { version } = await resolveSolc(range);

  if (!versionCache.has(version)) {
    const soljson = await fetchSolc(version);
    versionCache.set(version, await loadSolc(soljson));
  }

  return versionCache.get(version);
}

// "^0.8.0" and ">=0.8.0 <0.9.0" may resolve to same version
const compiler1 = await getCompilerForRange("^0.8.0");
const compiler2 = await getCompilerForRange(">=0.8.0 <0.9.0");
```

### Offline usage

```javascript
// Pre-download compilers during build
const soljson = await fetchSolc("0.8.26");
fs.writeFileSync("./compilers/solc-0.8.26.js", soljson);

// Load from filesystem later
const soljson = fs.readFileSync("./compilers/solc-0.8.26.js", "utf8");
const solc = await loadSolc(soljson);
```

### Custom CDN

```javascript
const solc = await fetchAndLoadSolc("^0.8.0", {
  fetch: {
    repository: {
      baseUrl: "https://my-mirror.com/solidity-compilers",
    },
  },
});
```

### Working with multiple versions

```javascript
const [solc8, solc7] = await Promise.all([
  fetchAndLoadSolc("^0.8.0"),
  fetchAndLoadSolc("^0.7.0"),
]);

// Use the appropriate compiler based on pragma
const output = pragma.includes("0.8")
  ? await solc8.compile(input)
  : await solc7.compile(input);

// Clean up when done
solc8.stopWorker();
solc7.stopWorker();
```

## TypeScript support

This package is written in TypeScript and includes comprehensive type definitions.

<details>
<summary>View type definitions</summary>

```typescript
import type {
  WebSolc,
  CompilerInput,
  CompilerOutput,
  FetchOptions,
  LoadOptions,
  FetchAndLoadOptions,
} from "web-solc";

// Core instance type
interface WebSolc {
  compile(input: CompilerInput): Promise<CompilerOutput>;
  stopWorker(): void;
}

// Options for fetchSolc
interface FetchOptions {
  repository?: {
    baseUrl?: string;
  };
}

// Options for loadSolc
interface LoadOptions {
  compatibility?: {
    disableCompilerInterfaces?: Array<"legacy" | "modern">;
  };
}

// Combined options for fetchAndLoadSolc
interface FetchAndLoadOptions {
  fetch?: FetchOptions;
  load?: LoadOptions;
}
```

</details>

## Solidity version support

- **Browser**: 0.4.26, 0.5.3+ (with some gaps due to browser limitations)
- **Node.js**: 0.4.16+

See the [detailed compatibility report](../../COMPATIBILITY.md) for specific version support.
