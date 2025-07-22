// Mapping of Solidity versions to appropriate contract files
export function getContractForVersion(version: string): {
  fileName: string;
  contractName: string;
} {
  const [majorStr, minorStr, patchStr] = version.split(".");
  const major = parseInt(majorStr);
  const minor = parseInt(minorStr);
  const patch = parseInt(patchStr);

  // Very old versions (< 0.4.0)
  if (major === 0 && minor < 4) {
    return {
      fileName: "legacy.sol",
      contractName: "Test",
    };
  }

  // 0.4.0 - 0.4.21: function-named constructors
  if (major === 0 && minor === 4 && patch < 22) {
    return {
      fileName: "v0.4-legacy.sol",
      contractName: "Test",
    };
  }

  // 0.4.22 - 0.4.26: constructor keyword
  if (major === 0 && minor === 4 && patch >= 22) {
    return {
      fileName: "v0.4.sol",
      contractName: "Test",
    };
  }

  // 0.5.x: explicit visibility, uint256
  if (major === 0 && minor === 5) {
    return {
      fileName: "v0.5.sol",
      contractName: "Test",
    };
  }

  // 0.6.x: similar to 0.5 but need different pragma
  if (major === 0 && minor === 6) {
    return {
      fileName: "v0.6.sol",
      contractName: "Test",
    };
  }

  // 0.7.x: constructor visibility deprecated
  if (major === 0 && minor === 7) {
    return {
      fileName: "v0.7.sol",
      contractName: "Test",
    };
  }

  // 0.8.x: similar to 0.7
  if (major === 0 && minor === 8) {
    return {
      fileName: "v0.8.sol",
      contractName: "Test",
    };
  }

  throw new Error(`Unknown version: ${version}`);
}

// Representative versions for fast local testing
export const representativeVersions = [
  "0.4.26", // Latest 0.4.x that works
  "0.5.3", // Early 0.5.x that works in browser
  "0.5.6", // Latest 0.5.x that works in browser
  "0.6.12", // Latest 0.6.x
  "0.7.6", // Latest 0.7.x
  "0.8.0", // First 0.8.x
  "0.8.19", // Mid 0.8.x with significant changes
  "0.8.30", // Latest 0.8.x
];
