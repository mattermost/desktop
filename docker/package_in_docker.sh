#!/bin/sh
# This script should be executed in docker container.
set -ex
cd electron-mattermost
npm run package:all
npm run package:linux
