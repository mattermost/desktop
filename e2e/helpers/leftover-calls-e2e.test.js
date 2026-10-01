// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/helpers/*.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const e2eRoot = path.join(__dirname, '..');
const userSrc = fs.readFileSync(path.join(e2eRoot, 'helpers/server_api/user.ts'), 'utf8');
const channelSrc = fs.readFileSync(path.join(e2eRoot, 'helpers/server_api/channel.ts'), 'utf8');
const globalSetupSrc = fs.readFileSync(path.join(e2eRoot, 'global-setup.ts'), 'utf8');

describe('user.ts leftover sweep uses the 60-minute age filter', () => {
    it('archives only isStaleLeftoverCallsE2EChannel hits', () => {
        assert.match(userSrc, /import \{isStaleLeftoverCallsE2EChannel\} from '\.\.\/leftoverCallsChannel'/);
        assert.match(userSrc, /if \(isStaleLeftoverCallsE2EChannel\(channel\)\)/);
    });
});

describe('concurrent leftover archive', () => {
    it('apiArchiveChannel treats already-archived 400/404 as success', () => {
        assert.match(channelSrc, /status === 400 \|\| status === 404/);
        assert.match(channelSrc, /isAlreadyArchivedChannelStatus\(error\.status\)/);
    });
});

describe('globalSetup leftover sweep + shard-1 Calls restart', () => {
    it('sweeps leftovers on every shard, then restarts Calls only on shard 1', () => {
        assert.match(globalSetupSrc, /archiveLeftoverCallsE2EChannels\(serverUrl, token\)/);
        assert.match(globalSetupSrc, /if \(restartPlugin\) \{/);
        assert.match(globalSetupSrc, /await ensureCallsPlugin\(serverUrl, token\);/);
        assert.doesNotMatch(globalSetupSrc, /await waitForCallsPluginReady/);
        assert.match(globalSetupSrc, /const restartCallsPlugin = !config\.shard \|\| config\.shard\.current === 1;/);

        const sweepIdx = globalSetupSrc.indexOf('archiveLeftoverCallsE2EChannels(serverUrl, token)');
        const restartIdx = globalSetupSrc.indexOf('if (restartPlugin) {');
        assert.ok(sweepIdx > 0 && restartIdx > sweepIdx, 'sweep must run before shard-1 plugin restart');
        assert.equal(globalSetupSrc.includes('if (restartPlugin) {\n        const archived'), false);
    });
});
