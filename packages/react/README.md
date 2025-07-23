# @web-solc/react

[![npm version](https://img.shields.io/npm/v/%40web-solc%2Freact)](https://www.npmjs.com/package/@web-solc/react)

React bindings for web-solc with hooks for Solidity compilation.

## Installation

```bash
npm install --save @web-solc/react
```

## Quick start

```tsx
import { useWebSolc } from "@web-solc/react";

function CompilerComponent() {
  const compiler = useWebSolc({ version: "^0.8.0" });

  if (compiler.loading) return <div>Loading compiler...</div>;
  if (compiler.error) return <div>Error: {compiler.error.message}</div>;

  const handleCompile = async () => {
    const result = await compiler.compile({
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

    console.log("Compilation result:", result);
  };

  return <button onClick={handleCompile}>Compile</button>;
}
```

## Core concepts

This package provides a `useWebSolc` hook that works standalone or with an optional provider for caching:

- **Standalone usage**: Each component manages its own compiler instance
- **With provider**: Soljson strings are cached and shared across components
- **Automatic cleanup**: Web Workers are properly terminated when components unmount
- **Version resolution**: Version ranges (like `^0.8.0`) are resolved to exact versions automatically

## API reference

### Hooks

<details>
<summary><code>useWebSolc(options)</code> — Hook for loading and using Solidity compilers</summary>

```typescript
function useWebSolc(options: UseWebSolcOptions): UseWebSolcResult;
```

**Options:**

```typescript
interface UseWebSolcOptions {
  version?: string; // Version range like "^0.8.0"
  soljson?: string; // Direct compiler JavaScript
  fetchOptions?: FetchOptions;
  loadOptions?: LoadOptions;
}
```

**Returns** one of three states:

- `{ loading: true }` — Compiler is loading
- `{ loading: false, error: Error }` — Failed to load
- `{ loading: false, compile: Function }` — Ready to compile

**Example:**

```tsx
// Fetch compiler from CDN
const compiler = useWebSolc({ version: "^0.8.0" });

// Or use pre-loaded compiler
const compiler = useWebSolc({ soljson: preloadedSoljson });

if (compiler.loading) return <div>Loading...</div>;
if (compiler.error) return <div>Error: {compiler.error.message}</div>;

// compiler.compile is available
const output = await compiler.compile(input);
```

</details>

### Components

<details>
<summary><code>WebSolcProvider</code> — Optional provider for compiler caching</summary>

```typescript
interface WebSolcProviderProps {
  cache?: SoljsonCache; // Custom cache implementation
  fetchOptions?: FetchOptions;
  loadOptions?: LoadOptions;
}
```

**Props:**

- `cache` — Soljson cache implementation (defaults to in-memory cache)
- `fetchOptions` — Default options for CDN fetching
- `loadOptions` — Default compiler loading options

**Example:**

```tsx
import { WebSolcProvider } from "@web-solc/react";

<WebSolcProvider>
  <App />
</WebSolcProvider>;
```

</details>

### Cache interface

<details>
<summary><code>SoljsonCache</code> — Interface for custom caching strategies</summary>

```typescript
interface SoljsonCache {
  get(version: string): Promise<string | undefined>;
  set(version: string, soljson: string): Promise<void>;
  clear(): Promise<void>;
}
```

The cache stores soljson strings (compiler JavaScript), not compiled instances. The hook handles loading internally. You can provide your own implementation for different caching strategies (e.g., IndexedDB, localStorage).

**Example custom cache:**

```typescript
class PersistentCache implements SoljsonCache {
  async get(version: string) {
    // Load soljson string from IndexedDB, localStorage, etc.
    return localStorage.getItem(`soljson-${version}`) || undefined;
  }

  async set(version: string, soljson: string) {
    // Store soljson string for later retrieval
    localStorage.setItem(`soljson-${version}`, soljson);
  }

  async clear() {
    // Clean up all stored soljson strings
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('soljson-')) {
        localStorage.removeItem(key);
      }
    }
  }
}

<WebSolcProvider cache={new PersistentCache()}>
  <App />
</WebSolcProvider>
```

</details>

## Common patterns

### Basic usage without provider

```tsx
import { useWebSolc } from "@web-solc/react";

function MyComponent() {
  const compiler = useWebSolc({ version: "^0.8.0" });

  // Each component gets its own compiler instance
  // Cleanup happens automatically on unmount
}
```

### Shared compilers with provider

```tsx
import { WebSolcProvider, useWebSolc } from "@web-solc/react";

function App() {
  return (
    <WebSolcProvider>
      <CompilerA />
      <CompilerB />
    </WebSolcProvider>
  );
}

function CompilerA() {
  const compiler = useWebSolc({ version: "0.8.26" });
  // First component triggers loading
}

function CompilerB() {
  const compiler = useWebSolc({ version: "0.8.26" });
  // Second component reuses cached soljson
}
```

### Pre-loading compilers

```tsx
import { useWebSolc } from "@web-solc/react";
import { fetchSolc } from "web-solc";

// Pre-fetch during build or initialization
const soljson = await fetchSolc("0.8.26");

function MyComponent() {
  // Loads instantly, no network request
  const compiler = useWebSolc({ soljson });
}
```

### Dynamic version selection

```tsx
function CompilerSelector() {
  const [version, setVersion] = useState("^0.8.0");
  const compiler = useWebSolc({ version });

  return (
    <div>
      <select value={version} onChange={(e) => setVersion(e.target.value)}>
        <option value="^0.8.0">Latest 0.8.x</option>
        <option value="^0.7.0">Latest 0.7.x</option>
        <option value="0.8.19">Exact 0.8.19</option>
      </select>

      {compiler.loading && <div>Loading compiler...</div>}
      {compiler.error && <div>Error: {compiler.error.message}</div>}
      {compiler.compile && <CompileButton compile={compiler.compile} />}
    </div>
  );
}
```

### Compilation with error handling

```tsx
function CompileButton({ source }: { source: string }) {
  const compiler = useWebSolc({ version: "^0.8.0" });
  const [output, setOutput] = useState<CompilerOutput | null>(null);

  if (compiler.loading) return <button disabled>Loading compiler...</button>;
  if (compiler.error) return <div>Compiler unavailable</div>;

  const handleCompile = async () => {
    const result = await compiler.compile({
      language: "Solidity",
      sources: { "Contract.sol": { content: source } },
      settings: {
        outputSelection: { "*": { "*": ["*"] } },
      },
    });

    setOutput(result);
  };

  return (
    <>
      <button onClick={handleCompile}>Compile</button>
      {output?.errors && (
        <div>
          {output.errors.map((err, i) => (
            <div key={i} className={err.severity}>
              {err.formattedMessage}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
```

### Custom CDN configuration

```tsx
// Configure at hook level
const compiler = useWebSolc({
  version: "^0.8.0",
  fetchOptions: {
    repository: {
      baseUrl: "https://my-mirror.com/solidity-compilers",
    },
  },
});

// Or configure globally with provider
<WebSolcProvider
  fetchOptions={{
    repository: {
      baseUrl: "https://my-mirror.com/solidity-compilers",
    },
  }}
>
  <App />
</WebSolcProvider>;
```

## TypeScript support

This package is written in TypeScript with full type definitions.

<details>
<summary>View type definitions</summary>

```typescript
// Hook options
interface UseWebSolcOptions {
  version?: string; // Version range (e.g., "^0.8.0")
  soljson?: string; // Direct compiler JavaScript
  fetchOptions?: FetchOptions;
  loadOptions?: LoadOptions;
}

// Hook result - discriminated union for type safety
type UseWebSolcResult =
  | { loading: true; error?: never; compile?: never }
  | { loading: false; error: Error; compile?: never }
  | {
      loading: false;
      error?: never;
      compile: (input: CompilerInput) => Promise<CompilerOutput>;
    };

// Provider props
interface WebSolcProviderProps {
  cache?: SoljsonCache;
  fetchOptions?: FetchOptions;
  loadOptions?: LoadOptions;
  children: React.ReactNode;
}

// Cache interface for custom implementations
interface SoljsonCache {
  get(version: string): Promise<string | undefined>;
  set(version: string, soljson: string): Promise<void>;
  clear(): Promise<void>;
}
```

</details>

## License

MIT
