#!/bin/bash

if [ "$GITHUB_EVENT_NAME" == "pull_request" ]; then
    echo "BRANCH=$GITHUB_EVENT_PULL_REQUEST_HEAD_REF" >> $GITHUB_ENV
    echo "BUILD_SUFFIX=desktop-pr" >> $GITHUB_ENV
    echo "TYPE=PR" >> $GITHUB_ENV

elif [ "$GITHUB_EVENT_NAME" == "release" ] || [ "$GITHUB_EVENT_NAME" == "workflow_dispatch" ]; then
    echo "BRANCH=$GITHUB_REF" >> $GITHUB_ENV
    echo "BUILD_SUFFIX=desktop-release" >> $GITHUB_ENV
    echo "TYPE=RELEASE" >> $GITHUB_ENV
    echo "ZEPHYR_ENABLE=true" >> $GITHUB_ENV

elif [ "$GITHUB_EVENT_NAME" == "push" ] && [ "$GITHUB_REF" == "refs/heads/master" ]; then
    echo "BRANCH=$GITHUB_REF" >> $GITHUB_ENV
    echo "TYPE=MASTER" >> $GITHUB_ENV
    echo "BUILD_SUFFIX=desktop-master-push" >> $GITHUB_ENV
    echo "ZEPHYR_ENABLE=true" >> $GITHUB_ENV

elif [ "$GITHUB_EVENT_NAME" == "schedule" ]; then
    echo "BRANCH=$GITHUB_REF" >> $GITHUB_ENV
    echo "BUILD_SUFFIX=desktop-nightly" >> $GITHUB_ENV
    echo "TYPE=NIGHTLY" >> $GITHUB_ENV
fi

echo "BUILD_ID=$GITHUB_RUN_ID-${BUILD_SUFFIX}-$RUNNER_OS" >> $GITHUB_ENV
echo "BUILD_TAG=${GITHUB_SHA::7}" >> $GITHUB_ENV
echo "PULL_REQUEST=${PULL_REQUEST_BASE_URL}$GITHUB_EVENT_PULL_REQUEST_NUMBER" >> $GITHUB_ENV
