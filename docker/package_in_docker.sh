#!/bin/sh
# This script should be executed in docker container.
set -ex
cd electron-mattermost
./node_modules/gulp/bin/gulp.js package
