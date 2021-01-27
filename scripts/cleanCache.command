#!/bin/bash
BASE_DIR=~/Library/ApplicationSupport/Mattermost
realpath $BASE_DIR/* | grep -v .json | xargs -I{} rm -rf "{}"