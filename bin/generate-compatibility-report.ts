#!/usr/bin/env tsx

import { spawn } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as semver from "semver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

type Build = "wasm" | "emscripten";
type Status = "pass" | "fail" | "skip";

interface BuildResults {
  wasm: {
    browser: Status;
    node: Status;
  };
  emscripten: {
    browser: Status;
    node: Status;
  };
}

interface VersionRange {
  range: string;
  browserStatus: string;
  nodeStatus: string;
  notes: string[];
  versions: string[];
}

async function runTests(testFile: string): Promise<Map<string, Status>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, Status>();

    const proc = spawn(
      "yarn",
      [
        "vitest",
        "run",
        "--config",
        "vitest.config.compat.ts",
        "--reporter=json",
        testFile,
      ],
      {
        cwd: repoRoot,
        env: { ...process.env },
      }
    );

    let output = "";
    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`Test process exited with code ${code}`));
        return;
      }

      try {
        // Parse JSON output
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          reject(new Error("Could not find JSON output"));
          return;
        }

        const testResults = JSON.parse(jsonMatch[0]);

        // Extract results for each version and build
        testResults.testResults?.forEach(
          (file: {
            assertionResults?: Array<{
              title?: string;
              status: string;
              failureMessages?: string[];
            }>;
          }) => {
            file.assertionResults?.forEach((test) => {
              // Match version and build from test title
              const match = test.title?.match(/v([\d.]+), (wasm|emscripten)\)/);
              if (match) {
                const [, version, build] = match;
                const key = `${version}-${build}`;

                // Check if it's a "file not found" failure
                const isFileNotFound = test.failureMessages?.some(
                  (msg) =>
                    msg.includes("file not found") ||
                    msg.includes("not available for")
                );

                if (isFileNotFound) {
                  results.set(key, "skip");
                } else {
                  results.set(key, test.status === "passed" ? "pass" : "fail");
                }
              }
            });
          }
        );

        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Group results by version
function groupByVersion(
  browserResults: Map<string, Status>,
  nodeResults: Map<string, Status>
): Map<string, BuildResults> {
  const versionMap = new Map<string, BuildResults>();

  // Get all unique versions
  const allKeys = new Set([...browserResults.keys(), ...nodeResults.keys()]);

  for (const key of allKeys) {
    const [version, build] = key.split("-") as [string, Build];

    if (!versionMap.has(version)) {
      versionMap.set(version, {
        wasm: { browser: "skip", node: "skip" },
        emscripten: { browser: "skip", node: "skip" },
      });
    }

    const versionResults = versionMap.get(version)!;
    versionResults[build].browser = browserResults.get(key) || "skip";
    versionResults[build].node = nodeResults.get(key) || "skip";
  }

  return versionMap;
}

// Compress ranges within a minor version
function compressMinorVersion(
  versions: Array<[string, BuildResults]>
): VersionRange[] {
  if (versions.length === 0) return [];

  // Sort versions
  const sorted = versions.sort(([a], [b]) => semver.compare(a, b));

  const ranges: VersionRange[] = [];
  let currentRange: VersionRange | null = null;

  for (const [version, results] of sorted) {
    // Determine browser and node status with notes
    const browserWorks =
      results.wasm.browser === "pass" || results.emscripten.browser === "pass";
    const nodeWorks =
      results.wasm.node === "pass" || results.emscripten.node === "pass";

    const notes: string[] = [];

    // Also check if the WASM file actually exists
    const wasmPath = resolve(
      repoRoot,
      `packages/web-solc/vendor/wasm/soljson-v${version}.js`
    );
    const wasmFileExists = existsSync(wasmPath);

    if (
      browserWorks &&
      results.wasm.browser === "pass" &&
      results.emscripten.browser !== "pass"
    ) {
      notes.push("Browser requires WebAssembly build");
    } else if (
      browserWorks &&
      results.wasm.browser !== "pass" &&
      results.emscripten.browser === "pass" &&
      wasmFileExists
    ) {
      notes.push("Only Emscripten build available");
    }

    if (!wasmFileExists && (browserWorks || nodeWorks)) {
      notes.push("No WebAssembly build");
    }

    const browserStatus = browserWorks ? "✅" : "❌";
    const nodeStatus = nodeWorks ? "✅" : "❌";
    const noteString = notes.join(", ");

    // Check if we can extend the current range
    const isSameStatus =
      currentRange &&
      currentRange.browserStatus === browserStatus &&
      currentRange.nodeStatus === nodeStatus &&
      currentRange.notes.join(", ") === noteString;

    if (!currentRange || !isSameStatus) {
      // Start new range
      if (currentRange) {
        ranges.push(currentRange);
      }
      currentRange = {
        range: version,
        browserStatus,
        nodeStatus,
        notes,
        versions: [version],
      };
    } else {
      // Extend current range
      currentRange.versions.push(version);
    }
  }

  // Don't forget the last range
  if (currentRange) {
    ranges.push(currentRange);
  }

  // Format range strings
  ranges.forEach((range) => {
    range.range = createRangeString(range.versions);
  });

  return ranges;
}

// Create a human-readable range string
function createRangeString(versions: string[]): string {
  if (versions.length === 1) {
    return versions[0];
  }

  if (versions.length === 2) {
    return `${versions[0]}, ${versions[1]}`;
  }

  // For 3+ consecutive versions, show as range
  const first = versions[0];
  const last = versions[versions.length - 1];

  // Check if all versions are truly consecutive
  let allConsecutive = true;
  for (let i = 0; i < versions.length - 1; i++) {
    const current = semver.parse(versions[i])!;
    const next = semver.parse(versions[i + 1])!;

    if (current.major !== next.major || current.minor !== next.minor) {
      allConsecutive = false;
      break;
    }

    if (next.patch !== current.patch + 1) {
      allConsecutive = false;
      break;
    }
  }

  if (allConsecutive) {
    return `${first} - ${last}`;
  } else {
    // Not all consecutive, list them
    if (versions.length > 5) {
      return `${versions.length} versions (${first} ... ${last})`;
    }
    return versions.join(", ");
  }
}

async function generateReport() {
  console.log("Running browser tests...");
  const browserResults = await runTests("compat/browser.test.ts");

  console.log("Running Node.js tests...");
  const nodeResults = await runTests("compat/node.test.ts");

  // Group results by version
  const versionResults = groupByVersion(browserResults, nodeResults);

  // Sort all versions
  const sortedVersions = Array.from(versionResults.entries()).sort(([a], [b]) =>
    semver.compare(a, b)
  );

  // Calculate stats
  const stats = {
    total: sortedVersions.length,
  };

  // Find version boundaries
  const firstWasmVersion =
    sortedVersions.find(
      ([, r]) => r.wasm.browser !== "skip" || r.wasm.node !== "skip"
    )?.[0] || "unknown";

  // Find the last version that works but has no WASM
  let lastNoWasmVersion: string | undefined;
  for (let i = sortedVersions.length - 1; i >= 0; i--) {
    const [version, results] = sortedVersions[i];
    const hasWasm =
      results.wasm.browser !== "skip" || results.wasm.node !== "skip";
    const works =
      results.emscripten.browser === "pass" ||
      results.emscripten.node === "pass";

    if (!hasWasm && works) {
      lastNoWasmVersion = version;
      break;
    }
  }

  // Generate markdown report
  let markdown = `# Solidity Version Compatibility

This document details the compatibility of web-solc with different Solidity compiler versions based on automated testing.

Generated: ${new Date().toISOString()}
**Total versions tested**: ${stats.total}

## Quick Reference

### Fully Supported (Browser & Node.js)

`;

  // Extract versions that work in both browser and Node.js (with either build)
  const fullySupported = sortedVersions.filter(
    ([, r]) =>
      (r.wasm.browser === "pass" || r.emscripten.browser === "pass") &&
      (r.wasm.node === "pass" || r.emscripten.node === "pass")
  );
  const nodeOnly = sortedVersions.filter(
    ([, r]) =>
      r.wasm.browser !== "pass" &&
      r.emscripten.browser !== "pass" &&
      (r.wasm.node === "pass" || r.emscripten.node === "pass")
  );
  const notSupported = sortedVersions.filter(
    ([, r]) =>
      r.wasm.browser !== "pass" &&
      r.emscripten.browser !== "pass" &&
      r.wasm.node !== "pass" &&
      r.emscripten.node !== "pass"
  );

  markdown +=
    extractMajorRanges(fullySupported.map(([v]) => v)).join(", ") + "\n";

  markdown += `
### Node.js Only

`;
  markdown += extractMajorRanges(nodeOnly.map(([v]) => v)).join(", ") + "\n";

  markdown += `
### Not Supported

`;
  markdown +=
    extractMajorRanges(notSupported.map(([v]) => v)).join(", ") + "\n";

  markdown += `
## Detailed Results

| Version Range | Browser | Node.js | Notes |
|--------------|---------|---------|-------|
`;

  // Group by minor version
  const byMinor = new Map<string, Array<[string, BuildResults]>>();
  for (const [version, results] of sortedVersions) {
    const parsed = semver.parse(version);
    if (!parsed) continue;

    const minorVersion = `${parsed.major}.${parsed.minor}`;
    if (!byMinor.has(minorVersion)) {
      byMinor.set(minorVersion, []);
    }
    byMinor.get(minorVersion)!.push([version, results]);
  }

  // Add compressed results to table (newest first)
  const sortedMinors = Array.from(byMinor.keys()).sort((a, b) => {
    const [aMajor, aMinor] = a.split(".").map(Number);
    const [bMajor, bMinor] = b.split(".").map(Number);

    if (aMajor !== bMajor) return bMajor - aMajor;
    return bMinor - aMinor;
  });

  for (const minorVersion of sortedMinors) {
    const versions = byMinor.get(minorVersion)!;
    const ranges = compressMinorVersion(versions);

    markdown += `| **${minorVersion}.x** | | | |\n`;

    // Reverse ranges to show newest patches first within each minor version
    ranges.reverse().forEach((range) => {
      const noteStr = range.notes.length > 0 ? range.notes.join(", ") : "";
      markdown += `| ${range.range} | ${range.browserStatus} | ${range.nodeStatus} | ${noteStr} |\n`;
    });
  }

  markdown += `
## Legend

- ✅ Pass - Version is fully supported
- ❌ Fail - Version fails to compile or has errors
- **Browser requires WebAssembly build** - Emscripten build causes stack overflow in browsers

## Build Information

- **WebAssembly builds**: Available from Solidity ${firstWasmVersion}+${lastNoWasmVersion ? `. Versions through ${lastNoWasmVersion} only have Emscripten builds.` : ""}
- **Emscripten builds**: Available for all versions but may cause stack overflow in browsers for older versions (0.4.x and 0.5.x)

## Known Issues

### Browser Stack Overflow

Many 0.4.x and 0.5.x versions fail in browser environments when using Emscripten builds due to stack overflow errors. These versions work correctly:
- In Node.js with Emscripten builds
- In browsers with WASM builds (when available)

### Pre-0.4.11 Versions

Versions before 0.4.11 are not supported as they don't properly support the Standard JSON input/output format used by web-solc.

## Testing

To regenerate this report:

\`\`\`bash
# From repository root
yarn test:compat:download  # Download all compiler versions
yarn test:compat:report    # Generate this report
\`\`\`
`;

  // Write report to repo root
  const reportPath = resolve(repoRoot, "COMPATIBILITY.md");
  writeFileSync(reportPath, markdown);
  console.log(`Report written to: ${reportPath}`);

  // Find earliest supported versions (preferring WASM for badges)
  const browserFirst =
    sortedVersions.find(([, r]) => r.wasm.browser === "pass")?.[0] || "none";
  const nodeFirst =
    sortedVersions.find(([, r]) => r.wasm.node === "pass")?.[0] || "none";

  // Generate browser badge
  const browserBadgeData = {
    schemaVersion: 1,
    label: "solc support (browser)",
    message: browserFirst === "none" ? "not supported" : `${browserFirst}+`,
    color: browserFirst === "none" ? "red" : "brightgreen",
  };

  const browserBadgePath = resolve(
    repoRoot,
    "browser-compatibility-badge.json"
  );
  writeFileSync(browserBadgePath, JSON.stringify(browserBadgeData, null, 2));
  console.log(`Browser badge data written to: ${browserBadgePath}`);

  // Generate Node.js badge
  const nodeBadgeData = {
    schemaVersion: 1,
    label: "solc support (Node.js)",
    message: nodeFirst === "none" ? "not supported" : `${nodeFirst}+`,
    color: nodeFirst === "none" ? "red" : "brightgreen",
  };

  const nodeBadgePath = resolve(repoRoot, "node-compatibility-badge.json");
  writeFileSync(nodeBadgePath, JSON.stringify(nodeBadgeData, null, 2));
  console.log(`Node badge data written to: ${nodeBadgePath}`);
}

// Extract clean ranges grouped by major version
function extractMajorRanges(versions: string[]): string[] {
  if (versions.length === 0) return ["_None_"];

  const sorted = semver.sort(versions);
  const byMajor = new Map<number, string[]>();

  // Group by major version
  sorted.forEach((v) => {
    const parsed = semver.parse(v);
    if (!parsed) return;

    if (!byMajor.has(parsed.major)) {
      byMajor.set(parsed.major, []);
    }
    byMajor.get(parsed.major)!.push(v);
  });

  // Create ranges for each major version
  const ranges: string[] = [];

  Array.from(byMajor.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([_major, versions]) => {
      const minorGroups = groupByMinor(versions);

      minorGroups.forEach((group) => {
        if (group.length === 1) {
          ranges.push(group[0]);
        } else {
          const first = group[0];
          const last = group[group.length - 1];

          // Check if this is a complete range
          if (isCompleteMinorRange(group)) {
            ranges.push(`${first} - ${last}`);
          } else {
            // Show explicit versions for incomplete ranges
            if (group.length > 4) {
              ranges.push(`${first} - ${last} (partial)`);
            } else {
              ranges.push(group.join(", "));
            }
          }
        }
      });
    });

  return ranges;
}

// Group versions by minor version ranges
function groupByMinor(versions: string[]): string[][] {
  const groups: string[][] = [];
  let currentGroup: string[] = [];

  const sorted = semver.sort(versions);

  for (let i = 0; i < sorted.length; i++) {
    currentGroup.push(sorted[i]);

    if (i < sorted.length - 1) {
      const current = semver.parse(sorted[i])!;
      const next = semver.parse(sorted[i + 1])!;

      // Check if we should start a new group
      const shouldBreak =
        // Different minor version with gap
        (current.minor !== next.minor && next.minor !== current.minor + 1) ||
        // Same minor but patch gap
        (current.minor === next.minor && next.patch !== current.patch + 1) ||
        // Next minor but not starting at patch 0
        (next.minor === current.minor + 1 && next.patch !== 0);

      if (shouldBreak) {
        groups.push([...currentGroup]);
        currentGroup = [];
      }
    } else {
      groups.push([...currentGroup]);
    }
  }

  return groups;
}

// Check if a group forms a complete minor version range
function isCompleteMinorRange(versions: string[]): boolean {
  if (versions.length < 2) return false;

  for (let i = 1; i < versions.length; i++) {
    const prev = semver.parse(versions[i - 1])!;
    const curr = semver.parse(versions[i])!;

    // Within same minor
    if (prev.minor === curr.minor) {
      if (curr.patch !== prev.patch + 1) return false;
    }
    // Next minor
    else if (curr.minor === prev.minor + 1) {
      if (curr.patch !== 0) return false;
    } else {
      return false;
    }
  }

  return true;
}

// Run the report generator
generateReport().catch((error) => {
  console.error("Error generating report:", error);
  process.exit(1);
});
