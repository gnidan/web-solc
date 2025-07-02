# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

web-solc is a monorepo that provides Solidity compilation capabilities for web environments. It consists of:

- **web-solc**: Core package for browser-compatible Solidity compilation using Web Workers
- **@web-solc/react**: React bindings with hooks and context providers
- **example**: Vite-based demo application

## Key Commands

### Development

```bash
# Install dependencies and build all packages
yarn install

# Start development mode (watches all packages)
yarn start

# Build specific package
cd packages/web-solc && yarn prepare
cd packages/react && yarn prepare

# Run the example app only
cd packages/example && yarn dev
```

### Building

```bash
# Build all packages (runs automatically on install)
yarn postinstall

# Build individual packages
cd packages/web-solc && yarn prepare
cd packages/react && yarn prepare
cd packages/example && yarn build
```

### Testing

```bash
# Run all tests across the monorepo
yarn test

# Run tests with coverage
yarn test:coverage

# Run browser integration tests
yarn test:integration

# Run tests for specific packages
cd packages/web-solc && yarn test
cd packages/react && yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with UI
cd packages/web-solc && yarn test:ui
```

The project uses **Vitest** for unit testing and **Playwright** for browser integration tests. All packages have comprehensive test coverage including:

- Unit tests for all core modules (browser, node, common)
- React component and hook tests with proper mocking
- Browser integration tests for real compilation scenarios

## Architecture

### Core Design Principles

1. **Dual Environment Support**: The core web-solc package provides different implementations for browser (Web Workers) and Node.js environments
2. **Version Resolution**: Uses semver to fetch compatible Solidity compiler versions from binaries.soliditylang.org
3. **Worker Isolation**: Browser compilation runs in Web Workers to prevent blocking the main thread
4. **Type Safety**: Full TypeScript with strict mode enabled

### Key Implementation Details

**Browser Implementation** (`packages/web-solc/src/browser.ts`):

- Creates Web Workers using Blob URLs with embedded worker code
- Uses Emscripten's `cwrap` to interface with WebAssembly
- Automatic worker cleanup on `stopWorker()`

**Node.js Implementation** (`packages/web-solc/src/node.ts`):

- Direct execution using Function constructor with context injection
- Creates Module proxy to handle `__dirname` access
- No worker overhead for server-side compilation

**React Integration** (`packages/react/src/`):

- Context-based compiler instance management
- Automatic Web Worker cleanup on unmount
- Returns `undefined` during loading for clean loading states

### Entry Points

- Browser: `dist/src/browser.js`
- Node.js: `dist/src/node.js`
- React: `dist/src/index.jsx`

## Development Patterns

### Working with the Monorepo

- Lerna manages independent versioning for packages
- Yarn workspaces handle dependencies
- The `bin/start` script runs all packages concurrently in watch mode

### Adding New Features

1. Check existing patterns in similar files
2. Maintain dual environment support if modifying core functionality
3. Ensure TypeScript types are properly exported
4. Follow the existing file structure (interface → common → environment-specific)
5. Write tests for new functionality - aim for comprehensive coverage
6. Run tests before committing: `yarn test`

### Code Conventions

- Use TypeScript's strict mode settings
- ES modules throughout (type: "module" in package.json)
- Minimal dependencies (only semver in core package)
- Clear separation between browser and Node.js code paths
- Import React explicitly when using JSX: `import React from 'react'`
- Mock external dependencies in tests rather than making real network calls
- Use `.js` extensions in relative imports for ES module compatibility

### Testing Conventions

- Place test files next to source files with `.test.ts` or `.test.tsx` extension
- Use descriptive test names that explain what is being tested
- Mock external dependencies (like `web-solc` in React tests)
- Integration tests go in `tests/integration/` directory
- Use `vi.fn()` for creating mock functions in Vitest
- Clean up resources (workers, browsers) in test teardown

### Code Quality Tools

#### Linting
```bash
# Run ESLint across the entire monorepo
yarn lint

# Fix auto-fixable issues
yarn lint:fix

# Run in specific package
cd packages/web-solc && yarn lint
```

The project uses ESLint 8 with TypeScript support and the following plugins:
- `@typescript-eslint` for TypeScript-specific rules
- `eslint-plugin-react` and `eslint-plugin-react-hooks` for React code
- `eslint-plugin-prettier` to integrate Prettier formatting

#### Formatting
```bash
# Format all files
yarn format

# Check formatting without changing files
yarn format:check
```

Prettier is configured with:
- 80 character line width
- Double quotes for strings
- Trailing commas (ES5 style)
- Semicolons required
- Unix line endings (LF)

## CI/CD

The project uses GitHub Actions for continuous integration:

- **Test Workflow** (`.github/workflows/test.yml`):
  - Runs on push to main and pull requests
  - Tests on Node.js 18.x and 20.x
  - Cross-platform testing on Ubuntu, macOS, and Windows
  - Runs unit tests, coverage reports, and integration tests
  - Automatically installs Playwright browsers for integration testing
