#!/bin/bash

# Script to download all soljson files for testing
# Files are downloaded to the vendor/ directory which is gitignored

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Vendor directory is one level up from bin
VENDOR_DIR="$SCRIPT_DIR/../vendor"

# Create vendor directory if it doesn't exist
mkdir -p "$VENDOR_DIR"

cd "$VENDOR_DIR"

# All stable versions
versions=(
  "0.1.1" "0.1.2" "0.1.3" "0.1.4" "0.1.5" "0.1.6" "0.1.7"
  "0.2.0" "0.2.1" "0.2.2"
  "0.3.0" "0.3.1" "0.3.2" "0.3.3" "0.3.4" "0.3.5" "0.3.6"
  "0.4.0" "0.4.1" "0.4.2" "0.4.3" "0.4.4" "0.4.5" "0.4.6" "0.4.7" "0.4.8" "0.4.9"
  "0.4.10" "0.4.11" "0.4.12" "0.4.13" "0.4.14" "0.4.15" "0.4.16" "0.4.17" "0.4.18"
  "0.4.19" "0.4.20" "0.4.21" "0.4.22" "0.4.23" "0.4.24" "0.4.25" "0.4.26"
  "0.5.0" "0.5.1" "0.5.2" "0.5.3" "0.5.4" "0.5.5" "0.5.6" "0.5.7" "0.5.8" "0.5.9"
  "0.5.10" "0.5.11" "0.5.12" "0.5.13" "0.5.14" "0.5.15" "0.5.16" "0.5.17"
  "0.6.0" "0.6.1" "0.6.2" "0.6.3" "0.6.4" "0.6.5" "0.6.6" "0.6.7" "0.6.8" "0.6.9"
  "0.6.10" "0.6.11" "0.6.12"
  "0.7.0" "0.7.1" "0.7.2" "0.7.3" "0.7.4" "0.7.5" "0.7.6"
  "0.8.0" "0.8.1" "0.8.2" "0.8.3" "0.8.4" "0.8.5" "0.8.6" "0.8.7" "0.8.8" "0.8.9"
  "0.8.10" "0.8.11" "0.8.12" "0.8.13" "0.8.14" "0.8.15" "0.8.16" "0.8.17" "0.8.18"
  "0.8.19" "0.8.20" "0.8.21" "0.8.22" "0.8.23" "0.8.24" "0.8.25" "0.8.26" "0.8.27"
  "0.8.28" "0.8.29" "0.8.30"
)

# Base URL for binaries
BASE_URL="https://binaries.soliditylang.org/bin"

# Fetch list.json to get exact filenames
echo "Fetching list.json..."
curl -s "$BASE_URL/list.json" > list.json

echo "Downloading soljson files..."

for version in "${versions[@]}"; do
  # Skip if file already exists
  if [ -f "soljson-v${version}.js" ]; then
    echo "Already have soljson-v${version}.js, skipping..."
    continue
  fi
  
  # Find the exact filename from list.json
  filename=$(jq -r ".builds[] | select(.longVersion | startswith(\"${version}+\")) | .path" list.json | head -1)
  
  if [ -z "$filename" ]; then
    echo "Warning: Could not find soljson for version $version"
    continue
  fi
  
  echo "Downloading $filename for version $version..."
  curl -s "$BASE_URL/$filename" > "soljson-v${version}.js"
  
  # Add a small delay to be nice to the server
  sleep 0.1
done

# Clean up
rm -f list.json

echo "Done! Downloaded $(ls soljson-v*.js 2>/dev/null | wc -l) soljson files."
