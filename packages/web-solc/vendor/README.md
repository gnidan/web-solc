# Solidity Compiler Files

This directory contains Solidity compiler (soljson) files for testing, organized by build type.

## Directory Structure

```
vendor/
├── wasm/          # WebAssembly builds (available from v0.3.6+)
├── emscripten/    # Emscripten builds (available for all versions)
└── README.md
```

## Representative Versions (Committed)

The following versions are committed to the repository for CI/CD and quick local testing:

### WASM Builds (Used by default in tests)
- `wasm/soljson-v0.4.26.js` - Latest working 0.4.x version
- `wasm/soljson-v0.5.3.js` - Early 0.5.x version
- `wasm/soljson-v0.5.6.js` - Latest 0.5.x version
- `wasm/soljson-v0.6.12.js` - Latest 0.6.x version
- `wasm/soljson-v0.7.6.js` - Latest 0.7.x version
- `wasm/soljson-v0.8.0.js` - First 0.8.x version
- `wasm/soljson-v0.8.19.js` - Mid 0.8.x version with significant changes
- `wasm/soljson-v0.8.30.js` - Latest tested 0.8.x version

### Emscripten Builds (For compatibility testing)
- Same versions as above in the `emscripten/` directory

These versions cover major syntax changes and known edge cases across Solidity's evolution.

## Full Version Set (Git Ignored)

For comprehensive compatibility testing, you can download all versions:

```bash
cd packages/web-solc
yarn test:compat:download
```

This will download:
- **WASM builds**: Versions 0.3.6 to 0.8.30+ (recommended for browser use)
- **Emscripten builds**: All versions from 0.1.1 to 0.8.30+

These files are git-ignored to keep the repository size manageable.

## Build Type Differences

### WebAssembly (WASM) Builds
- Available from Solidity 0.3.6 onwards
- More efficient and less prone to stack overflow in browsers
- Recommended for browser environments
- Smaller file sizes

### Emscripten Builds
- Available for all Solidity versions
- May cause stack overflow in browsers for older versions (0.4.x and 0.5.x)
- Work reliably in Node.js environments
- Larger file sizes

## File Sizes

Note that compiler files can be quite large:
- Early versions (0.1.x - 0.3.x): 6-20MB (Emscripten only)
- Mid versions (0.4.x - 0.5.x): 8-11MB  
- Recent versions (0.6.x - 0.8.x): 8-23MB

The committed representative versions total approximately 110MB.