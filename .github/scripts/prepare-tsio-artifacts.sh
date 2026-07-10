#!/usr/bin/env bash
# Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.
#
# Stage the minimal files TSIO needs (JSON report + failure screenshots).
# Playwright also writes trace zips and per-test output under test-results/;
# those are useful for local debugging but bloat the OIDC-split CI artifact.
set -euo pipefail

SRC="${1:-e2e/test-results}"
DEST="${2:-tsio-artifact/e2e/test-results}"
GENERATE_FROM_BLOB="${3:-false}"

rm -rf "$(dirname "$DEST")"
mkdir -p "$DEST"

json="$SRC/results.json"

if [ ! -f "$json" ] && [ "$GENERATE_FROM_BLOB" = "true" ] && [ -d e2e/blob-report ]; then
  echo "Synthesizing results.json from blob-report..."
  (cd e2e && npx playwright merge-reports --config playwright.report-merge.config.ts blob-report)
fi

if [ ! -f "$json" ]; then
  echo "::warning::No Playwright results.json at ${json} — TSIO upload will be skipped"
  echo "has_results=false"
  exit 0
fi

cp "$json" "$DEST/"

while IFS= read -r -d '' png; do
  rel="${png#"${SRC}"/}"
  mkdir -p "$DEST/$(dirname "$rel")"
  cp "$png" "$DEST/$rel"
done < <(find "$SRC" -name '*.png' -type f -print0)

echo "has_results=true"
