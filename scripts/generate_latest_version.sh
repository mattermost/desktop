#!/usr/bin/env bash
set -e

VERSION="$(jq -r '.version' <package.json)"

if [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+-([^.]+) ]]; then
    RELEASE_VERSION="${BASH_REMATCH[1]}"
    FILENAME="${RELEASE_VERSION}.txt"
else
    FILENAME="latest.txt"
fi

OUTPUT_FILE="${1:-./${FILENAME}}"

echo "${VERSION}" > "${OUTPUT_FILE}"
echo "Generated ${OUTPUT_FILE} with version ${VERSION}"
echo "FILENAME=${FILENAME}" >> $GITHUB_OUTPUT
