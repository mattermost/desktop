// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Run: node --test e2e/helpers/callsLogs.test.js

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {callsLogsBranch} = require('./callsLogs');

describe('callsLogsBranch', () => {
    it('treats Calls 1.12.0 and newer, including pre-releases, as the upload confirmation', () => {
        assert.equal(callsLogsBranch('1.12.0'), 'modern');
        assert.equal(callsLogsBranch('1.12.0-rc1'), 'modern');
        assert.equal(callsLogsBranch('1.13.2'), 'modern');
    });

    it('treats older resolved Calls versions as the seeded echo', () => {
        assert.equal(callsLogsBranch('1.11.9'), 'legacy');
        assert.equal(callsLogsBranch('0.16.0'), 'legacy');
    });

    it('accepts either marker when the plugin version cannot be resolved', () => {
        assert.equal(callsLogsBranch(undefined), 'unresolved');
        assert.equal(callsLogsBranch(null), 'unresolved');
        assert.equal(callsLogsBranch(''), 'unresolved');
    });
});
