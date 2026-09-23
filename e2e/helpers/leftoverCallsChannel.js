// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const CALLS_E2E_DISPLAY_PREFIX = 'Calls E2E ';
const CALLS_E2E_NAME_PATTERN = /^e2ec\d/;

/** Leftovers younger than this may still belong to a live shard or CMT OS leg. */
const LEFTOVER_CALLS_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * @param {{name: string, display_name?: string, delete_at?: number, type?: string}} channel
 * @returns {boolean}
 */
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

/**
 * True when the channel is a leftover Calls E2E private channel old enough
 * that no in-flight shard should still be using it.
 *
 * @param {{name: string, display_name?: string, delete_at?: number, type?: string, create_at?: number}} channel
 * @param {number} [now]
 * @returns {boolean}
 */
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
