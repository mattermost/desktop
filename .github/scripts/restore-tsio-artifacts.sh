#!/usr/bin/env bash
# Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.
#
# Materialize e2e/test-results/ from a downloaded TSIO artifact, tolerating
# upload-artifact root-directory differences across versions.
set -euo pipefail

mkdir -p e2e/test-results
rm -rf e2e/test-results/*

json=""
for candidate in \
  tsio-artifact/e2e/test-results/results.json \
  e2e/test-results-tsio/results.json \
  e2e/test-results/results.json; do
  if [ -f "$candidate" ]; then
    json="$candidate"
    break
  fi
done

if [ -z "$json" ]; then
  json="$(find . -path '*/test-results/results.json' -type f 2>/dev/null | head -1 || true)"
fi

if [ -z "$json" ]; then
  echo "::warning::Downloaded TSIO artifact is missing test-results/results.json — skipping upload"
  echo "found=false"
  exit 0
fi

cp -a "$(dirname "$json")/." e2e/test-results/
echo "found=true"
