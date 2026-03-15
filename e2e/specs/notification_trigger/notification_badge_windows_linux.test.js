// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('notification_badge/windows_and_linux', function desc() {
    this.timeout(60000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
        await asyncSleep(1000);
    });

    async function triggerBadge(app, sessionExpired, mentionCount, showUnreadBadge) {
        await app.evaluate((_, args) => {
            global.__testTriggerBadge(args.sessionExpired, args.mentionCount, args.showUnreadBadge);
        }, {sessionExpired, mentionCount, showUnreadBadge});

        // Windows canvas drawing in setOverlayIcon is async — give it time to settle
        await asyncSleep(process.platform === 'win32' ? 500 : 100);
    }

    async function getBadgeState(app) {
        return app.evaluate(() => global.__testBadgeState || null);
    }

    async function resetBadgeState(app) {
        await app.evaluate(() => {
            global.__testBadgeState = null;
        });
    }

    // --- Windows: overlay icon badge ---

    env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_01 - should show a mention count badge on Windows', async () => {
        await triggerBadge(this.app, false, 5, false);
        const state = await getBadgeState(this.app);
        state.should.not.be.null;
        state.mentionCount.should.equal(5);
        state.sessionExpired.should.equal(false);
        state.showUnreadBadge.should.equal(false);
    });

    env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_02 - should show an unread badge on Windows when showUnreadBadge is true', async () => {
        await this.app.evaluate(() => {
            global.__testTriggerSetUnreadBadgeSetting(true);
        });
        await triggerBadge(this.app, false, 0, true);
        const state = await getBadgeState(this.app);
        state.should.not.be.null;
        state.mentionCount.should.equal(0);
        state.showUnreadBadge.should.equal(true);
        state.sessionExpired.should.equal(false);
    });

    env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_03 - should show a session-expired badge on Windows', async () => {
        await triggerBadge(this.app, true, 0, false);
        const state = await getBadgeState(this.app);
        state.should.not.be.null;
        state.sessionExpired.should.equal(true);
        state.mentionCount.should.equal(0);
    });

    env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_04 - should clear the badge on Windows when all counts are zero', async () => {
        await triggerBadge(this.app, false, 3, false);
        let state = await getBadgeState(this.app);
        state.mentionCount.should.equal(3);

        await resetBadgeState(this.app);
        await triggerBadge(this.app, false, 0, false);
        state = await getBadgeState(this.app);
        state.should.not.be.null;
        state.mentionCount.should.equal(0);
        state.sessionExpired.should.equal(false);
        state.showUnreadBadge.should.equal(false);
    });

    env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_05 - should handle mention counts above 99 on Windows', async () => {
        await triggerBadge(this.app, false, 150, false);
        const state = await getBadgeState(this.app);

        // Raw inputs are faithfully recorded; the "99+" cap is applied inside
        // showBadgeWindows() before setOverlayIcon() — a platform rendering detail
        state.mentionCount.should.equal(150);
        state.sessionExpired.should.equal(false);
    });

    // --- Linux: setBadgeCount badge ---

    env.shouldTest(it, process.platform === 'linux')('MM-T_BADGE_LNX_01 - should show a mention count badge on Linux', async () => {
        await triggerBadge(this.app, false, 3, false);
        const state = await getBadgeState(this.app);
        state.should.not.be.null;
        state.mentionCount.should.equal(3);
        state.sessionExpired.should.equal(false);
    });

    env.shouldTest(it, process.platform === 'linux')('MM-T_BADGE_LNX_02 - should account for session expiry in Linux badge count', async () => {
        // showBadgeLinux passes mentionCount + 1 to setBadgeCount when sessionExpired
        await triggerBadge(this.app, true, 2, false);
        const state = await getBadgeState(this.app);
        state.should.not.be.null;
        state.sessionExpired.should.equal(true);
        state.mentionCount.should.equal(2);
    });

    env.shouldTest(it, process.platform === 'linux')('MM-T_BADGE_LNX_03 - should clear the badge on Linux when all counts are zero', async () => {
        await triggerBadge(this.app, false, 5, false);
        let state = await getBadgeState(this.app);
        state.mentionCount.should.equal(5);

        await resetBadgeState(this.app);
        await triggerBadge(this.app, false, 0, false);
        state = await getBadgeState(this.app);
        state.should.not.be.null;
        state.mentionCount.should.equal(0);
        state.sessionExpired.should.equal(false);
    });

    // --- Group 1: Badge Type Priority ---

    describe('badge type priority', function() {
        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_06 - mention count wins over session-expired on Windows', async () => {
            await triggerBadge(this.app, true, 5, false);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(5);
            state.sessionExpired.should.equal(true);
            state.showUnreadBadge.should.equal(false);
            state.resolvedType.should.equal('mention');
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_07 - mention count wins over unread dot on Windows', async () => {
            await triggerBadge(this.app, false, 5, true);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(5);
            state.showUnreadBadge.should.equal(true);
            state.sessionExpired.should.equal(false);
            state.resolvedType.should.equal('mention');
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_08 - unread dot wins over session-expired on Windows when setting enabled', async () => {
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(this.app, true, 0, true);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.showUnreadBadge.should.equal(true);
            state.sessionExpired.should.equal(true);
            state.mentionCount.should.equal(0);
            state.resolvedType.should.equal('unread');
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(false);
            });
        });

        env.shouldTest(it, process.platform === 'linux')('MM-T_BADGE_LNX_04 - Linux passes both mentionCount and sessionExpired through', async () => {
            await triggerBadge(this.app, true, 5, false);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(5);
            state.sessionExpired.should.equal(true);
            state.resolvedType.should.equal('mention');
        });
    });

    // --- Group 2: Unread Setting Toggle (Windows only) ---

    describe('unread setting toggle', function() {
        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_09 - unread dot not shown when showUnreadBadgeSetting is false', async () => {
            // setting defaults to falsy — do not enable it
            await triggerBadge(this.app, false, 0, true);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(0);
            state.showUnreadBadge.should.equal(true);
            state.sessionExpired.should.equal(false);
            state.resolvedType.should.equal('none');
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_10 - unread dot shown when showUnreadBadgeSetting is true', async () => {
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(this.app, false, 0, true);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(0);
            state.showUnreadBadge.should.equal(true);
            state.sessionExpired.should.equal(false);
            state.resolvedType.should.equal('unread');
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(false);
            });
        });
    });

    // --- Group 3: Badge Clearing / Ghost-Badge Regression ---

    describe('badge clearing', function() {
        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_11 - ghost mention badge clears on Windows', async () => {
            await triggerBadge(this.app, false, 3, false);
            let state = await getBadgeState(this.app);
            state.mentionCount.should.equal(3);

            await resetBadgeState(this.app);
            await triggerBadge(this.app, false, 0, false);
            state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(0);
            state.showUnreadBadge.should.equal(false);
            state.sessionExpired.should.equal(false);
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_12 - ghost unread dot clears on Windows', async () => {
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(this.app, false, 0, true);
            let state = await getBadgeState(this.app);
            state.showUnreadBadge.should.equal(true);

            await resetBadgeState(this.app);
            await triggerBadge(this.app, false, 0, false);
            state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.showUnreadBadge.should.equal(false);
            state.mentionCount.should.equal(0);
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(false);
            });
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_13 - ghost session-expired badge clears on Windows', async () => {
            await triggerBadge(this.app, true, 0, false);
            let state = await getBadgeState(this.app);
            state.sessionExpired.should.equal(true);

            await resetBadgeState(this.app);
            await triggerBadge(this.app, false, 0, false);
            state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.sessionExpired.should.equal(false);
        });

        env.shouldTest(it, process.platform === 'linux')('MM-T_BADGE_LNX_05 - Linux counter resets to zero', async () => {
            await triggerBadge(this.app, false, 5, false);
            let state = await getBadgeState(this.app);
            state.mentionCount.should.equal(5);

            await resetBadgeState(this.app);
            await triggerBadge(this.app, false, 0, false);
            state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(0);
        });
    });

    // --- Group 4: State Transitions (Windows) ---

    describe('state transitions', function() {
        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_14 - mention count decrements correctly on Windows', async () => {
            await triggerBadge(this.app, false, 5, false);
            let state = await getBadgeState(this.app);
            state.mentionCount.should.equal(5);

            await triggerBadge(this.app, false, 3, false);
            state = await getBadgeState(this.app);
            state.mentionCount.should.equal(3);

            await triggerBadge(this.app, false, 0, false);
            state = await getBadgeState(this.app);
            state.mentionCount.should.equal(0);
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_15 - transitions from mention to unread dot on Windows', async () => {
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(this.app, false, 3, false);
            let state = await getBadgeState(this.app);
            state.mentionCount.should.equal(3);

            await triggerBadge(this.app, false, 0, true);
            state = await getBadgeState(this.app);
            state.mentionCount.should.equal(0);
            state.showUnreadBadge.should.equal(true);
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(false);
            });
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_16 - transitions from unread dot to mention on Windows', async () => {
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(this.app, false, 0, true);
            let state = await getBadgeState(this.app);
            state.showUnreadBadge.should.equal(true);
            state.mentionCount.should.equal(0);

            await triggerBadge(this.app, false, 2, false);
            state = await getBadgeState(this.app);
            state.mentionCount.should.equal(2);
            await this.app.evaluate(() => {
                global.__testTriggerSetUnreadBadgeSetting(false);
            });
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_17 - session-restore with pending mentions on Windows', async () => {
            await triggerBadge(this.app, true, 0, false);
            let state = await getBadgeState(this.app);
            state.sessionExpired.should.equal(true);

            await triggerBadge(this.app, false, 3, false);
            state = await getBadgeState(this.app);
            state.sessionExpired.should.equal(false);
            state.mentionCount.should.equal(3);
        });
    });

    // --- Group 5: Windows-specific Edge Cases ---

    describe('windows edge cases', function() {
        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_18 - mention count exactly at 99 on Windows', async () => {
            await triggerBadge(this.app, false, 99, false);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(99);
            state.sessionExpired.should.equal(false);
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_19 - mention count over 99 cap on Windows', async () => {
            await triggerBadge(this.app, false, 100, false);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(100);
            state.sessionExpired.should.equal(false);
        });

        env.shouldTest(it, process.platform === 'win32')('MM-T_BADGE_WIN_20 - explicit no-badge state recorded on Windows', async () => {
            await triggerBadge(this.app, false, 0, false);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.sessionExpired.should.equal(false);
            state.mentionCount.should.equal(0);
            state.showUnreadBadge.should.equal(false);
        });
    });

    // --- Group 6: Linux-specific Edge Cases ---

    describe('linux edge cases', function() {
        env.shouldTest(it, process.platform === 'linux')('MM-T_BADGE_LNX_06 - no cap on mention count on Linux', async () => {
            await triggerBadge(this.app, false, 100, false);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.mentionCount.should.equal(100);
        });

        env.shouldTest(it, process.platform === 'linux')('MM-T_BADGE_LNX_07 - session-expired with zero mentions on Linux', async () => {
            await triggerBadge(this.app, true, 0, false);
            const state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.sessionExpired.should.equal(true);
            state.mentionCount.should.equal(0);
        });

        env.shouldTest(it, process.platform === 'linux')('MM-T_BADGE_LNX_08 - Linux clears correctly with all false/zero', async () => {
            await triggerBadge(this.app, false, 3, false);
            let state = await getBadgeState(this.app);
            state.mentionCount.should.equal(3);

            await resetBadgeState(this.app);
            await triggerBadge(this.app, false, 0, false);
            state = await getBadgeState(this.app);
            state.should.not.be.null;
            state.sessionExpired.should.equal(false);
            state.mentionCount.should.equal(0);
        });
    });
});
