// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/helpers/*.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CALLS_E2E_DISPLAY_PREFIX = 'Calls E2E ';
const CALLS_E2E_NAME_PATTERN = /^e2ec\d/;

/** Mirrors e2e/helpers/server_api/user.ts isLeftoverCallsE2EChannel. */
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

/** Mirrors e2e/helpers/server_api/channel.ts isAlreadyArchivedChannelStatus. */
function isAlreadyArchivedChannelStatus(status) {
    return status === 400 || status === 404;
}

const e2eRoot = path.join(__dirname, '..');
const userSrc = fs.readFileSync(path.join(e2eRoot, 'helpers/server_api/user.ts'), 'utf8');
const channelSrc = fs.readFileSync(path.join(e2eRoot, 'helpers/server_api/channel.ts'), 'utf8');
const globalSetupSrc = fs.readFileSync(path.join(e2eRoot, 'global-setup.ts'), 'utf8');

describe('isLeftoverCallsE2EChannel', () => {
    it('matches active Calls E2E private channels by display name or e2ec* name', () => {
        assert.equal(
            isLeftoverCallsE2EChannel({name: 'town-square', display_name: 'Calls E2E leftover', type: 'P', delete_at: 0}),
            true,
        );
        assert.equal(
            isLeftoverCallsE2EChannel({name: 'e2ec017000000001', display_name: 'other', type: 'P', delete_at: 0}),
            true,
        );
    });

    it('skips archived channels, public channels, and unrelated names', () => {
        assert.equal(
            isLeftoverCallsE2EChannel({name: 'e2ec017000000001', display_name: 'Calls E2E leftover', type: 'P', delete_at: 1}),
            false,
        );
        assert.equal(
            isLeftoverCallsE2EChannel({name: 'e2ec017000000001', display_name: 'Calls E2E leftover', type: 'O', delete_at: 0}),
            false,
        );
        assert.equal(
            isLeftoverCallsE2EChannel({name: 'off-topic', display_name: 'Off-Topic', type: 'O', delete_at: 0}),
            false,
        );
    });

    it('user.ts keeps the same leftover matcher', () => {
        assert.match(userSrc, /const CALLS_E2E_DISPLAY_PREFIX = 'Calls E2E '/);
        assert.match(userSrc, /const CALLS_E2E_NAME_PATTERN = \/\^e2ec\\d\//);
        assert.match(userSrc, /export async function archiveLeftoverCallsE2EChannels/);
        assert.match(userSrc, /await apiArchiveChannel\(baseUrl, adminToken, id\);/);
        assert.match(userSrc, /\/\/ Best-effort: a single archive failure must not abort setup\./);
    });
});

describe('concurrent leftover archive', () => {
    it('treats already-archived Mattermost statuses as success', () => {
        assert.equal(isAlreadyArchivedChannelStatus(400), true);
        assert.equal(isAlreadyArchivedChannelStatus(404), true);
        assert.equal(isAlreadyArchivedChannelStatus(403), false);
        assert.equal(isAlreadyArchivedChannelStatus(500), false);
    });

    it('apiArchiveChannel swallows 400/404 instead of throwing', () => {
        assert.match(channelSrc, /export function isAlreadyArchivedChannelStatus/);
        assert.match(channelSrc, /status === 400 \|\| status === 404/);
        assert.match(channelSrc, /isAlreadyArchivedChannelStatus\(error\.status\)/);
        assert.match(channelSrc, /throw error;/);
    });
});

describe('globalSetup leftover sweep + shard-1 Calls restart', () => {
    it('sweeps leftovers on every shard, then restarts Calls only on shard 1', () => {
        assert.match(globalSetupSrc, /archiveLeftoverCallsE2EChannels\(serverUrl, token\)/);
        assert.match(globalSetupSrc, /if \(restartPlugin\) \{/);
        assert.match(globalSetupSrc, /await ensureCallsPlugin\(serverUrl, token\);/);
        assert.match(globalSetupSrc, /await waitForCallsPluginReady\(serverUrl, token, 180_000\);/);
        assert.match(globalSetupSrc, /const restartCallsPlugin = !config\.shard \|\| config\.shard\.current === 1;/);

        const sweepIdx = globalSetupSrc.indexOf('archiveLeftoverCallsE2EChannels(serverUrl, token)');
        const restartIdx = globalSetupSrc.indexOf('if (restartPlugin) {');
        assert.ok(sweepIdx > 0 && restartIdx > sweepIdx, 'sweep must run before shard-1 plugin restart');
        assert.equal(globalSetupSrc.includes('if (restartPlugin) {\n        const archived'), false);
    });
});
