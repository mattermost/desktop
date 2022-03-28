#!/bin/sh

set -e

STABLE_VERSION=$(./node_modules/.bin/semver $(jq -r .version package.json) -c)
BUILD_VERSION=$(jq -r .version package.json | sed "s/$STABLE_VERSION-.*\.//g")

if [ "$BUILD_VERSION" == "" ]; then
    BUILD_VERSION=$STABLE_VERSION
fi

if [ "$CIRCLE_BUILD_NUM" != "" ]; then
    BUILD_VERSION=$CIRCLE_BUILD_NUM
fi

temp_file="$(mktemp -t electron-builder.json)"
jq -r --arg version "$STABLE_VERSION" '.mac.bundleShortVersion = $version' electron-builder.json > "${temp_file}" && mv "${temp_file}" electron-builder.json
jq -r --arg version "$BUILD_VERSION" '.mac.bundleVersion = $version' electron-builder.json > "${temp_file}" && mv "${temp_file}" electron-builder.json