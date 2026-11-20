// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Run: node --test e2e/helpers/leftoverCallsChannel.test.js

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    LEFTOVER_CALLS_MAX_AGE_MS,
    isLeftoverCallsE2EChannel,
    isStaleLeftoverCallsE2EChannel,
} = require('./leftoverCallsChannel');

const NOW = 1_700_000_000_000;

function leftover(overrides = {}) {
    return {
        name: 'e2ec01700000000001',
        display_name: 'Calls E2E e2ec01700000000001',
        delete_at: 0,
        type: 'P',
        create_at: NOW - LEFTOVER_CALLS_MAX_AGE_MS - 1,
        ...overrides,
    };
}

describe('isLeftoverCallsE2EChannel', () => {
    it('matches Calls E2E private e2ec channels', () => {
        assert.equal(isLeftoverCallsE2EChannel(leftover()), true);
        assert.equal(isLeftoverCallsE2EChannel(leftover({display_name: 'Other', name: 'e2ec1999'})), true);
        assert.equal(isLeftoverCallsE2EChannel(leftover({name: 'town-square', display_name: 'Calls E2E leftover'})), true);
    });

    it('rejects Town Square, Off-Topic, archived, public, and DMs', () => {
        assert.equal(isLeftoverCallsE2EChannel(leftover({name: 'town-square', display_name: 'Town Square'})), false);
        assert.equal(isLeftoverCallsE2EChannel(leftover({name: 'off-topic', display_name: 'Off-Topic'})), false);
        assert.equal(isLeftoverCallsE2EChannel(leftover({delete_at: NOW})), false);
        assert.equal(isLeftoverCallsE2EChannel(leftover({type: 'O'})), false);
        assert.equal(isLeftoverCallsE2EChannel(leftover({type: 'D'})), false);
    });
});

describe('isStaleLeftoverCallsE2EChannel age filter', () => {
    it('archives leftovers at or older than 60 minutes', () => {
        assert.equal(isStaleLeftoverCallsE2EChannel(leftover({create_at: NOW - LEFTOVER_CALLS_MAX_AGE_MS}), NOW), true);
        assert.equal(isStaleLeftoverCallsE2EChannel(leftover({create_at: NOW - LEFTOVER_CALLS_MAX_AGE_MS - 1}), NOW), true);
    });

    it('keeps leftovers younger than 60 minutes (in-flight shard / CMT OS leg)', () => {
        assert.equal(isStaleLeftoverCallsE2EChannel(leftover({create_at: NOW - (LEFTOVER_CALLS_MAX_AGE_MS - 1)}), NOW), false);
        assert.equal(isStaleLeftoverCallsE2EChannel(leftover({create_at: NOW}), NOW), false);
    });

    it('does not archive when create_at is missing or invalid', () => {
        assert.equal(isStaleLeftoverCallsE2EChannel(leftover({create_at: undefined}), NOW), false);
        assert.equal(isStaleLeftoverCallsE2EChannel(leftover({create_at: NaN}), NOW), false);
        assert.equal(isStaleLeftoverCallsE2EChannel(leftover({create_at: 0}), NOW), false);
        assert.equal(isStaleLeftoverCallsE2EChannel(leftover({create_at: -1}), NOW), false);
    });
});
