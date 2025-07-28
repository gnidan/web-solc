#!/usr/bin/env tsx

import { fetchSolc } from "../src/common.js";
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vendorDir = resolve(__dirname, "../vendor");

const builds: Array<"wasm" | "emscripten"> = ["wasm", "emscripten"];

interface BuildInfo {
  path: string;
  version: string;
  longVersion: string;
}

async function fetchVersionList(
  build: "wasm" | "emscripten"
): Promise<BuildInfo[]> {
  const baseUrl = "https://binaries.soliditylang.org";
  const path = build === "wasm" ? "wasm" : "bin";
  const response = await fetch(`${baseUrl}/${path}/list.json`);
  const data = (await response.json()) as {
    releases?: Record<string, string>;
    builds?: Array<{
      path: string;
      longVersion: string;
      prerelease: boolean;
    }>;
  };

  // Filter to only include releases (not nightlies)
  return data.releases
    ? Object.values(data.releases)
        .map((release) => ({
          path: release,
          version: release.match(/soljson-v([0-9.]+)\+/)?.[1] || "",
          longVersion: release,
        }))
        .filter((b): b is BuildInfo => b.version !== "")
    : (data.builds ?? [])
        .filter((b) => !b.prerelease && b.longVersion.includes("+commit."))
        .map((b) => ({
          path: b.path,
          version: b.longVersion.split("+")[0],
          longVersion: b.longVersion,
        }));
}

async function downloadVersion(version: string, build: "wasm" | "emscripten") {
  const buildDir = resolve(vendorDir, build);
  const filePath = resolve(buildDir, `soljson-v${version}.js`);

  // Skip if file already exists
  if (existsSync(filePath)) {
    console.log(`Already have ${build}/soljson-v${version}.js, skipping...`);
    return true;
  }

  try {
    console.log(`Downloading ${build}/soljson-v${version}.js...`);
    const soljson = await fetchSolc(version, { build });
    writeFileSync(filePath, soljson);

    // Add a small delay to be nice to the server
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    // If the version doesn't exist for this build, that's expected
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Could not find solc version")) {
      console.log(`Version ${version} not available for ${build} build`);
    } else {
      console.error(`Failed to download ${build} v${version}:`, errorMessage);
    }
    return false;
  }
}

async function main() {
  // Create vendor directories if they don't exist
  mkdirSync(vendorDir, { recursive: true });
  for (const build of builds) {
    mkdirSync(resolve(vendorDir, build), { recursive: true });
  }

  console.log("Fetching available versions...");

  // Get available versions for each build
  const versionsByBuild = new Map<string, Set<string>>();

  for (const build of builds) {
    console.log(`Fetching ${build} version list...`);
    const versions = await fetchVersionList(build);
    const uniqueVersions = new Set(versions.map((v) => v.version));
    versionsByBuild.set(build, uniqueVersions);
    console.log(`Found ${uniqueVersions.size} ${build} versions`);
  }

  // Get all unique versions across both builds
  const allVersions = new Set<string>();
  for (const versions of versionsByBuild.values()) {
    for (const version of versions) {
      allVersions.add(version);
    }
  }

  console.log(`\nTotal unique versions to download: ${allVersions.size}`);
  console.log("Downloading soljson files...\n");

  // Download all versions for available builds
  const sortedVersions = Array.from(allVersions).sort();
  let downloadedCount = 0;

  for (const version of sortedVersions) {
    for (const build of builds) {
      if (versionsByBuild.get(build)?.has(version)) {
        const success = await downloadVersion(version, build);
        if (success) downloadedCount++;
      }
    }
  }

  // Count downloaded files
  let wasmCount = 0;
  let emscriptenCount = 0;

  try {
    const wasmFiles = existsSync(resolve(vendorDir, "wasm"))
      ? readdirSync(resolve(vendorDir, "wasm")).filter((f) =>
          f.startsWith("soljson-")
        )
      : [];
    const emscriptenFiles = existsSync(resolve(vendorDir, "emscripten"))
      ? readdirSync(resolve(vendorDir, "emscripten")).filter((f) =>
          f.startsWith("soljson-")
        )
      : [];

    wasmCount = wasmFiles.length;
    emscriptenCount = emscriptenFiles.length;
  } catch {
    // Ignore errors in counting
  }

  console.log(`\nDone! Downloaded ${downloadedCount} files:`);
  console.log(`  - ${wasmCount} wasm builds`);
  console.log(`  - ${emscriptenCount} emscripten builds`);
  console.log(`  - ${wasmCount + emscriptenCount} total soljson files`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
