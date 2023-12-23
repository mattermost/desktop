#!/bin/bash

if [ "$github_event_name" == "pull_request" ]; then
    echo "BRANCH=$github_event_pull_request_head_ref" >> $GITHUB_ENV
    echo "BUILD_SUFFIX=desktop-pr" >> $GITHUB_ENV
    echo "TYPE=PR" >> $GITHUB_ENV

elif [ "$github_event_name" == "release" ] || [ "$github_event_name" == "workflow_dispatch" ]; then
    echo "BRANCH=$github_ref" >> $GITHUB_ENV
    echo "BUILD_SUFFIX=desktop-release" >> $GITHUB_ENV
    echo "TYPE=RELEASE" >> $GITHUB_ENV
    echo "ZEPHYR_ENABLE=true" >> $GITHUB_ENV

elif [ "$github_event_name" == "push" ] && [ "$github_ref" == "refs/heads/master" ]; then
    echo "BRANCH=$github_ref" >> $GITHUB_ENV
    echo "TYPE=MASTER" >> $GITHUB_ENV
    echo "BUILD_SUFFIX=desktop-master-push" >> $GITHUB_ENV
    echo "ZEPHYR_ENABLE=true" >> $GITHUB_ENV

elif [ "$github_event_name" == "schedule" ]; then
    echo "BRANCH=$github_ref" >> $GITHUB_ENV
    echo "BUILD_SUFFIX=desktop-nightly" >> $GITHUB_ENV
    echo "TYPE=NIGHTLY" >> $GITHUB_ENV
fi

echo "BUILD_ID=$github_run_id-${BUILD_SUFFIX}-$runner_os" >> $GITHUB_ENV
echo "BUILD_TAG=${GITHUB_SHA::7}" >> $GITHUB_ENV
echo "PULL_REQUEST=${PULL_REQUEST_BASE_URL}$github_event_pull_request_number" >> $GITHUB_ENV
