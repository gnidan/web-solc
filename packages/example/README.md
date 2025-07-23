# web-solc Example

This example demonstrates how to use web-solc with React and Vite, showcasing both the primary `loadSolc` pattern and the convenience CDN fetching pattern.

## Features Demonstrated

- **Primary pattern**: Loading compilers from your own source
- **Convenience pattern**: Auto-fetching from CDN
- **Loading states**: Proper handling of loading and error states
- **Compilation**: Basic Solidity compilation with output display

## Running the Example

From the repository root:

```bash
# Install dependencies and build packages
yarn install

# Run all packages in development mode
yarn start
```

Or run just the example:

```bash
cd packages/example
yarn dev
```

Then open http://localhost:5173 in your browser.

## Key Code Patterns

### Primary Pattern: Using Your Own Compiler Source

```tsx
// Fetch compiler from your source
const response = await fetch("/compilers/solc-0.8.26.js");
const soljson = await response.text();

// Use with the hook
const compiler = useWebSolc({ soljson });
```

### Convenience Pattern: Auto-fetch from CDN

```tsx
// Quick start - automatically fetches from official CDN
const compiler = useWebSolc({ version: "^0.8.0" });
```

### Complete Example

See [`src/App.tsx`](./src/App.tsx) for the full implementation showing:

- How to structure your React components
- Proper loading and error handling
- Compilation with the Standard JSON format
- Displaying compilation results

## Learn More

- [web-solc documentation](../../README.md) - Core library documentation
- [@web-solc/react documentation](../react/README.md) - React bindings documentation
- [Solidity Compiler JSON I/O](https://docs.soliditylang.org/en/latest/using-the-compiler.html#compiler-input-and-output-json-description) - Compiler input/output format

## Building for Production

This example uses Vite for development and production builds:

```bash
# Development mode with hot reload
yarn dev

# Production build
yarn build

# Preview production build
yarn preview
```
