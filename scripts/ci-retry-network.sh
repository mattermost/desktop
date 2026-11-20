#!/usr/bin/env bash
# Runs a command and re-runs it only when it failed on a download host's server or connection error
# (GitHub release downloads of Electron and electron-builder tools return 504 during outages).
# Any other failure exits at once with the command's own status.
#
#   bash ./scripts/ci-retry-network.sh npm ci
#
# CI_RETRY_ATTEMPTS (default 3) caps the attempts; the wait grows 30s per attempt.
set -uo pipefail

attempts="${CI_RETRY_ATTEMPTS:-3}"
network_error='Response code 5[0-9][0-9]|status code 5[0-9][0-9]|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up'
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

for ((attempt = 1; ; attempt++)); do
    "$@" 2>&1 | tee "$log"
    status="${PIPESTATUS[0]}"
    if [ "$status" -eq 0 ]; then
        exit 0
    fi
    if [ "$attempt" -ge "$attempts" ] || ! grep -qE "$network_error" "$log"; then
        exit "$status"
    fi
    wait_seconds=$((attempt * 30))
    echo "::warning::'$*' failed on a network error (attempt ${attempt} of ${attempts}); retrying in ${wait_seconds}s."
    sleep "$wait_seconds"
done
