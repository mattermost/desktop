// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const CALLS_E2E_DISPLAY_PREFIX = 'Calls E2E ';
const CALLS_E2E_NAME_PATTERN = /^e2ec\d/;

/** Leftovers younger than this may still belong to a live shard or CMT OS leg. */
const LEFTOVER_CALLS_MAX_AGE_MS = 60 * 60 * 1000;

function isLeftoverCallsE2EChannel(channel) {
    if (channel.delete_at) {
        return false;
    }
    if (channel.type && channel.type !== 'P') {
        return false;
    }
    const displayName = channel.display_name ?? '';
    return displayName.startsWith(CALLS_E2E_DISPLAY_PREFIX) || CALLS_E2E_NAME_PATTERN.test(channel.name);
}

/** A leftover Calls E2E private channel old enough that no in-flight shard can still be using it. */
function isStaleLeftoverCallsE2EChannel(channel, now = Date.now()) {
    if (!isLeftoverCallsE2EChannel(channel)) {
        return false;
    }
    const createdAt = channel.create_at;
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) {
        return false;
    }
    return (now - createdAt) >= LEFTOVER_CALLS_MAX_AGE_MS;
}

module.exports = {
    LEFTOVER_CALLS_MAX_AGE_MS,
    isLeftoverCallsE2EChannel,
    isStaleLeftoverCallsE2EChannel,
};
