# Solidity Compiler Files

This directory contains Solidity compiler (soljson) files for testing.

## Representative Versions (Committed)

The following versions are committed to the repository for CI/CD and quick local testing:

- `soljson-v0.4.26.js` - Latest working 0.4.x version for browsers
- `soljson-v0.5.3.js` - Early 0.5.x version that works in browsers
- `soljson-v0.5.6.js` - Latest 0.5.x version that works in browsers
- `soljson-v0.6.12.js` - Latest 0.6.x version
- `soljson-v0.7.6.js` - Latest 0.7.x version
- `soljson-v0.8.0.js` - First 0.8.x version
- `soljson-v0.8.19.js` - Mid 0.8.x version with significant changes
- `soljson-v0.8.30.js` - Latest tested 0.8.x version

These versions cover major syntax changes and known edge cases across Solidity's evolution.

## Full Version Set (Git Ignored)

For comprehensive compatibility testing, you can download all 113+ versions:

```bash
cd packages/web-solc
yarn test:compat:download
```

This will download all versions from 0.1.1 to 0.8.30. These files are git-ignored to keep the repository size manageable.

## File Sizes

Note that compiler files can be quite large:
- Early versions (0.1.x - 0.3.x): 6-20MB
- Mid versions (0.4.x - 0.5.x): 8-11MB  
- Recent versions (0.6.x - 0.8.x): 8-23MB

The committed representative versions total approximately 110MB.
