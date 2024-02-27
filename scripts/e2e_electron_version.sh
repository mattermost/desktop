#!/bin/bash

# Update electron version in package.json
jq '.devDependencies.electron = "27.0.2"' package.json > updated_package.json

mv updated_package.json package.json

echo "Electron version in package.json updated to 27.0.2"
