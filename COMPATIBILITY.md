# Solidity Version Compatibility

This document details the compatibility of web-solc with different Solidity compiler versions based on automated testing.

Generated: 2025-07-22T05:11:43.908Z  
**Total versions tested**: 113

## Quick Reference

### Fully Supported (Browser & Node.js)

0.4.26, 0.5.3 - 0.5.6, 0.5.14 - 0.8.30

### Node.js Only

0.4.16 - 0.5.2, 0.5.7 - 0.5.13

### Not Supported

0.1.1 - 0.4.15

## Detailed Results

| Version Range   | Browser | Node.js | Notes |
| --------------- | ------- | ------- | ----- |
| **0.8.x**       |         |         |       |
| 0.8.0 - 0.8.30  | ✅      | ✅      |       |
| **0.7.x**       |         |         |       |
| 0.7.0 - 0.7.6   | ✅      | ✅      |       |
| **0.6.x**       |         |         |       |
| 0.6.0 - 0.6.12  | ✅      | ✅      |       |
| **0.5.x**       |         |         |       |
| 0.5.14 - 0.5.17 | ✅      | ✅      |       |
| 0.5.7 - 0.5.13  | ❌      | ✅      |       |
| 0.5.3 - 0.5.6   | ✅      | ✅      |       |
| 0.5.0 - 0.5.2   | ❌      | ✅      |       |
| **0.4.x**       |         |         |       |
| 0.4.26          | ✅      | ✅      |       |
| 0.4.16 - 0.4.25 | ❌      | ✅      |       |
| 0.4.0 - 0.4.15  | ❌      | ❌      |       |
| **0.3.x**       |         |         |       |
| 0.3.0 - 0.3.6   | ❌      | ❌      |       |
| **0.2.x**       |         |         |       |
| 0.2.0 - 0.2.2   | ❌      | ❌      |       |
| **0.1.x**       |         |         |       |
| 0.1.1 - 0.1.7   | ❌      | ❌      |       |

## Legend

- ✅ Pass - Version is fully supported
- ❌ Fail - Version fails to compile or has errors
- ⏭️ Skip - Version was skipped in testing

## Known Issues

### Browser Stack Overflow

Many 0.4.x and 0.5.x versions fail in browser environments due to stack overflow errors when loading the large compiler JavaScript files. These versions work correctly in Node.js environments.

### Pre-0.4.11 Versions

Versions before 0.4.11 are not supported as they don't properly support the Standard JSON input/output format used by web-solc.

## Testing

To regenerate this report:

```bash
# From repository root
yarn test:compat:download  # Download all compiler versions
yarn test:compat:report    # Generate this report
```
