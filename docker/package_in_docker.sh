#!/bin/sh
# This script should be executed in docker container.
set -ex
npm run package:all
npm run package:linux
npm run installer
