#!/usr/bin/env tsx

import { spawn } from "child_process";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as semver from "semver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

interface VersionResult {
  version: string;
  browser: "pass" | "fail" | "skip";
  node: "pass" | "fail" | "skip";
  notes?: string;
}

interface VersionRange {
  range: string;
  browser: "pass" | "fail" | "mixed" | "skip";
  node: "pass" | "fail" | "mixed" | "skip";
  versions: string[];
}

async function runTests(testFile: string): Promise<Map<string, boolean>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, boolean>();

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

        // Extract results for each version
        testResults.testResults?.forEach(
          (file: {
            assertionResults?: Array<{ title?: string; status: string }>;
          }) => {
            file.assertionResults?.forEach((test) => {
              const versionMatch = test.title?.match(/v([\d.]+)\)$/);
              if (versionMatch) {
                const version = versionMatch[1];
                results.set(version, test.status === "passed");
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

// Compress ranges within a minor version using semver utilities
function compressMinorVersion(versions: VersionResult[]): VersionRange[] {
  if (versions.length === 0) return [];

  // Sort versions first
  const sorted = versions.sort((a, b) => semver.compare(a.version, b.version));

  const ranges: VersionRange[] = [];
  let currentRange: VersionRange | null = null;

  for (const version of sorted) {
    if (
      !currentRange ||
      currentRange.browser !== version.browser ||
      currentRange.node !== version.node
    ) {
      // Start new range with different status
      if (currentRange) {
        ranges.push(currentRange);
      }
      currentRange = {
        range: version.version,
        browser: version.browser,
        node: version.node,
        versions: [version.version],
      };
    } else {
      // Same status, check if consecutive
      const lastVersion =
        currentRange.versions[currentRange.versions.length - 1];
      const diff = semver.diff(lastVersion, version.version);

      // Only extend range if it's the next patch version
      if (diff === "patch") {
        const lastParsed = semver.parse(lastVersion)!;
        const currentParsed = semver.parse(version.version)!;

        if (currentParsed.patch === lastParsed.patch + 1) {
          currentRange.versions.push(version.version);
        } else {
          // Gap in patches, start new range
          ranges.push(currentRange);
          currentRange = {
            range: version.version,
            browser: version.browser,
            node: version.node,
            versions: [version.version],
          };
        }
      } else {
        // Different minor/major, start new range
        ranges.push(currentRange);
        currentRange = {
          range: version.version,
          browser: version.browser,
          node: version.node,
          versions: [version.version],
        };
      }
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
    return versions.join(", ");
  }

  // For 3+ consecutive versions, show as range
  const first = versions[0];
  const last = versions[versions.length - 1];

  // Check if all versions are truly consecutive
  let allConsecutive = true;
  for (let i = 0; i < versions.length - 1; i++) {
    if (semver.diff(versions[i], versions[i + 1]) !== "patch") {
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

  // Get all tested versions
  const allVersions = new Set([
    ...browserResults.keys(),
    ...nodeResults.keys(),
  ]);

  // Compile results
  const results: VersionResult[] = [];
  for (const version of allVersions) {
    const browserPass = browserResults.get(version);
    const nodePass = nodeResults.get(version);

    results.push({
      version,
      browser:
        browserPass === undefined ? "skip" : browserPass ? "pass" : "fail",
      node: nodePass === undefined ? "skip" : nodePass ? "pass" : "fail",
    });
  }

  // Sort all results using semver
  results.sort((a, b) => semver.compare(a.version, b.version));

  // Group by minor version
  const byMinor = new Map<string, VersionResult[]>();
  results.forEach((result) => {
    const parsed = semver.parse(result.version);
    if (!parsed) return;

    const minorVersion = `${parsed.major}.${parsed.minor}`;
    if (!byMinor.has(minorVersion)) {
      byMinor.set(minorVersion, []);
    }
    byMinor.get(minorVersion)!.push(result);
  });

  // Calculate stats
  const stats = {
    total: results.length,
    browserPass: results.filter((r) => r.browser === "pass").length,
    nodePass: results.filter((r) => r.node === "pass").length,
    bothPass: results.filter((r) => r.browser === "pass" && r.node === "pass")
      .length,
  };

  // Generate markdown report
  let markdown = `# Solidity Version Compatibility

This document details the compatibility of web-solc with different Solidity compiler versions based on automated testing.

Generated: ${new Date().toISOString()}  
**Total versions tested**: ${stats.total}

## Quick Reference

### Fully Supported (Browser & Node.js)

`;

  // Generate quick reference with better formatting
  const fullySupported = results.filter(
    (r) => r.browser === "pass" && r.node === "pass"
  );
  const nodeOnly = results.filter(
    (r) => r.browser === "fail" && r.node === "pass"
  );
  const notSupported = results.filter(
    (r) => r.browser === "fail" && r.node === "fail"
  );

  // Extract major version ranges for cleaner display
  const fullySupportedRanges = extractMajorRanges(
    fullySupported.map((r) => r.version)
  );
  const nodeOnlyRanges = extractMajorRanges(nodeOnly.map((r) => r.version));
  const notSupportedRanges = extractMajorRanges(
    notSupported.map((r) => r.version)
  );

  markdown += fullySupportedRanges.join(", ") + "\n";

  markdown += `
### Node.js Only

`;
  markdown += nodeOnlyRanges.join(", ") + "\n";

  markdown += `
### Not Supported

`;
  markdown += notSupportedRanges.join(", ") + "\n";

  markdown += `
## Detailed Results

| Version Range | Browser | Node.js | Notes |
|--------------|---------|---------|-------|
`;

  // Add compressed results to table (newest first)
  const sortedMinors = Array.from(byMinor.keys()).sort((a, b) => {
    // Parse minor versions and compare
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
      const browserIcon =
        range.browser === "pass"
          ? "✅"
          : range.browser === "fail"
            ? "❌"
            : "⏭️";
      const nodeIcon =
        range.node === "pass" ? "✅" : range.node === "fail" ? "❌" : "⏭️";
      markdown += `| ${range.range} | ${browserIcon} | ${nodeIcon} |  |\n`;
    });
  }

  markdown += `
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

  // Find earliest supported versions
  const browserSupported = results
    .filter((r) => r.browser === "pass")
    .sort((a, b) => semver.compare(a.version, b.version));
  const nodeSupported = results
    .filter((r) => r.node === "pass")
    .sort((a, b) => semver.compare(a.version, b.version));

  const earliestBrowser =
    browserSupported.length > 0 ? browserSupported[0].version : "none";
  const earliestNode =
    nodeSupported.length > 0 ? nodeSupported[0].version : "none";

  // Generate main compatibility badge (showing both)
  const badgeData = {
    schemaVersion: 1,
    label: "solidity",
    message: `browser: ${earliestBrowser}+ | node: ${earliestNode}+`,
    color: "brightgreen",
  };

  const badgePath = resolve(repoRoot, "compatibility-badge.json");
  writeFileSync(badgePath, JSON.stringify(badgeData, null, 2));
  console.log(`Badge data written to: ${badgePath}`);

  // Generate browser-specific badge
  const browserBadgeData = {
    schemaVersion: 1,
    label: "browser support",
    message:
      earliestBrowser === "none" ? "not supported" : `${earliestBrowser}+`,
    color: earliestBrowser === "none" ? "red" : "brightgreen",
  };

  const browserBadgePath = resolve(
    repoRoot,
    "browser-compatibility-badge.json"
  );
  writeFileSync(browserBadgePath, JSON.stringify(browserBadgeData, null, 2));
  console.log(`Browser badge data written to: ${browserBadgePath}`);

  // Generate node-specific badge
  const nodeBadgeData = {
    schemaVersion: 1,
    label: "node.js support",
    message: earliestNode === "none" ? "not supported" : `${earliestNode}+`,
    color: earliestNode === "none" ? "red" : "brightgreen",
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
