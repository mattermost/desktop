#!/usr/bin/env bash
set -e

CHANNEL="${1}"
temp_file="$(mktemp -t ${CHANNEL}XXX.yml)"
VERSION="$(jq -r '.version' <package.json)" yq eval -i '.files[].url |= strenv(VERSION) + "/" + .' ./release/${CHANNEL}.yml
