// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Run: node --test e2e/helpers/callsWidget.test.js

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const callsWidgetSrc = fs.readFileSync(path.join(__dirname, 'callsWidget.ts'), 'utf8');

describe('waitForCallsClientReady older-server gate', () => {
    it('waits for any mute control before the 1.12 disabled gate', () => {
        const waitFn = callsWidgetSrc.slice(
            callsWidgetSrc.indexOf('export async function waitForCallsClientReady'),
            callsWidgetSrc.indexOf('export async function sendWidgetShortcut'),
        );
        const muteWait = waitFn.indexOf('CALLS_MUTE_SELECTOR');
        const disabledWait = waitFn.indexOf('#voice-mute-unmute:not([disabled])');
        assert.ok(muteWait > 0, 'must wait for CALLS_MUTE_SELECTOR');
        assert.ok(disabledWait > muteWait, '1.12 :not([disabled]) wait must follow the dual selector');
        assert.match(waitFn, /resolveCallsPluginVersion/);
        assert.match(waitFn, /CALLS_DISABLED_WHILE_CONNECTING/);
    });

    it('toggles mute with Space on 1.12+ and m on older widgets', () => {
        assert.match(callsWidgetSrc, /legacyMuteKey \? \[pressM, pressSpace\] : \[pressSpace, pressM\]/);
        assert.match(callsWidgetSrc, /keyboard\.press\('m'\)/);
        assert.match(callsWidgetSrc, /sendWidgetShortcut\(electronApp, 'Space'/);
    });
});
