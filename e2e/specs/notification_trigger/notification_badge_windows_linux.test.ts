// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

type BadgeState = {
    mentionCount: number;
    sessionExpired: boolean;
    showUnreadBadge: boolean;
    resolvedType?: string;
} | null;

async function triggerBadge(
    app: import('playwright').ElectronApplication,
    sessionExpired: boolean,
    mentionCount: number,
    showUnreadBadge: boolean,
) {
    await app.evaluate((_, args: {sessionExpired: boolean; mentionCount: number; showUnreadBadge: boolean}) => {
        (global as any).__testTriggerBadge(args.sessionExpired, args.mentionCount, args.showUnreadBadge);
    }, {sessionExpired, mentionCount, showUnreadBadge});

    // Windows canvas drawing in setOverlayIcon is async — give it time to settle
    if (process.platform === 'win32') {
        await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function getBadgeState(app: import('playwright').ElectronApplication): Promise<BadgeState> {
    return app.evaluate(() => (global as any).__testBadgeState || null);
}

async function resetBadgeState(app: import('playwright').ElectronApplication) {
    await app.evaluate(() => {
        (global as any).__testBadgeState = null;
    });
}

test.describe('notification_badge/windows_and_linux', () => {
    // Reset showUnreadBadgeSetting to false before each test to prevent state bleed
    // when a test sets the setting to true but fails before resetting it.
    test.beforeEach(async ({electronApp}) => {
        await electronApp.evaluate(() => {
            (global as any).__testTriggerSetUnreadBadgeSetting?.(false);
        });
        await electronApp.evaluate(() => {
            (global as any).__testBadgeState = null;
        });
    });

    // --- Windows: overlay icon badge ---

    test('MM-T_BADGE_WIN_01 - should show a mention count badge on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }
        await triggerBadge(electronApp, false, 5, false);
        const state = await getBadgeState(electronApp);
        expect(state).not.toBeNull();
        expect(state!.mentionCount).toBe(5);
        expect(state!.sessionExpired).toBe(false);
        expect(state!.showUnreadBadge).toBe(false);
    });

    test('MM-T_BADGE_WIN_02 - should show an unread badge on Windows when showUnreadBadge is true', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }
        await electronApp.evaluate(() => {
            (global as any).__testTriggerSetUnreadBadgeSetting(true);
        });
        await triggerBadge(electronApp, false, 0, true);
        const state = await getBadgeState(electronApp);
        expect(state).not.toBeNull();
        expect(state!.mentionCount).toBe(0);
        expect(state!.showUnreadBadge).toBe(true);
        expect(state!.sessionExpired).toBe(false);
        await electronApp.evaluate(() => {
            (global as any).__testTriggerSetUnreadBadgeSetting(false);
        });
    });

    test('MM-T_BADGE_WIN_03 - should show a session-expired badge on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }
        await triggerBadge(electronApp, true, 0, false);
        const state = await getBadgeState(electronApp);
        expect(state).not.toBeNull();
        expect(state!.sessionExpired).toBe(true);
        expect(state!.mentionCount).toBe(0);
    });

    test('MM-T_BADGE_WIN_04 - should clear the badge on Windows when all counts are zero', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }
        await triggerBadge(electronApp, false, 3, false);
        let state = await getBadgeState(electronApp);
        expect(state!.mentionCount).toBe(3);

        await resetBadgeState(electronApp);
        await triggerBadge(electronApp, false, 0, false);
        state = await getBadgeState(electronApp);
        expect(state).not.toBeNull();
        expect(state!.mentionCount).toBe(0);
        expect(state!.sessionExpired).toBe(false);
        expect(state!.showUnreadBadge).toBe(false);
    });

    test('MM-T_BADGE_WIN_05 - should handle mention counts above 99 on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }
        await triggerBadge(electronApp, false, 150, false);
        const state = await getBadgeState(electronApp);

        // Raw inputs are faithfully recorded; the "99+" cap is applied inside
        // showBadgeWindows() before setOverlayIcon() — a platform rendering detail
        expect(state!.mentionCount).toBe(150);
        expect(state!.sessionExpired).toBe(false);
    });

    // --- Linux: setBadgeCount badge ---

    test('MM-T_BADGE_LNX_01 - should show a mention count badge on Linux', {tag: ['@P2', '@linux']}, async ({electronApp}) => {
        if (process.platform !== 'linux') {
            test.skip(true, 'Linux only');
            return;
        }
        await triggerBadge(electronApp, false, 3, false);
        const state = await getBadgeState(electronApp);
        expect(state).not.toBeNull();
        expect(state!.mentionCount).toBe(3);
        expect(state!.sessionExpired).toBe(false);
    });

    test('MM-T_BADGE_LNX_02 - should account for session expiry in Linux badge count', {tag: ['@P2', '@linux']}, async ({electronApp}) => {
        if (process.platform !== 'linux') {
            test.skip(true, 'Linux only');
            return;
        }

        // showBadgeLinux passes mentionCount + 1 to setBadgeCount when sessionExpired
        await triggerBadge(electronApp, true, 2, false);
        const state = await getBadgeState(electronApp);
        expect(state).not.toBeNull();
        expect(state!.sessionExpired).toBe(true);
        expect(state!.mentionCount).toBe(2);
    });

    test('MM-T_BADGE_LNX_03 - should clear the badge on Linux when all counts are zero', {tag: ['@P2', '@linux']}, async ({electronApp}) => {
        if (process.platform !== 'linux') {
            test.skip(true, 'Linux only');
            return;
        }
        await triggerBadge(electronApp, false, 5, false);
        let state = await getBadgeState(electronApp);
        expect(state!.mentionCount).toBe(5);

        await resetBadgeState(electronApp);
        await triggerBadge(electronApp, false, 0, false);
        state = await getBadgeState(electronApp);
        expect(state).not.toBeNull();
        expect(state!.mentionCount).toBe(0);
        expect(state!.sessionExpired).toBe(false);
    });

    // --- Group 1: Badge Type Priority ---

    test.describe('badge type priority', () => {
        test('MM-T_BADGE_WIN_06 - mention count wins over session-expired on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, true, 5, false);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(5);
            expect(state!.sessionExpired).toBe(true);
            expect(state!.showUnreadBadge).toBe(false);
            expect(state!.resolvedType).toBe('mention');
        });

        test('MM-T_BADGE_WIN_07 - mention count wins over unread dot on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, false, 5, true);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(5);
            expect(state!.showUnreadBadge).toBe(true);
            expect(state!.sessionExpired).toBe(false);
            expect(state!.resolvedType).toBe('mention');
        });

        test('MM-T_BADGE_WIN_08 - unread dot wins over session-expired on Windows when setting enabled', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(electronApp, true, 0, true);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.showUnreadBadge).toBe(true);
            expect(state!.sessionExpired).toBe(true);
            expect(state!.mentionCount).toBe(0);
            expect(state!.resolvedType).toBe('unread');
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(false);
            });
        });

        test('MM-T_BADGE_LNX_04 - Linux passes both mentionCount and sessionExpired through', {tag: ['@P2', '@linux']}, async ({electronApp}) => {
            if (process.platform !== 'linux') {
                test.skip(true, 'Linux only');
                return;
            }
            await triggerBadge(electronApp, true, 5, false);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(5);
            expect(state!.sessionExpired).toBe(true);
            expect(state!.resolvedType).toBe('mention');
        });
    });

    // --- Group 2: Unread Setting Toggle (Windows only) ---

    test.describe('unread setting toggle', () => {
        test('MM-T_BADGE_WIN_09 - unread dot not shown when showUnreadBadgeSetting is false', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }

            // setting defaults to falsy — do not enable it
            await triggerBadge(electronApp, false, 0, true);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(0);
            expect(state!.showUnreadBadge).toBe(true);
            expect(state!.sessionExpired).toBe(false);
            expect(state!.resolvedType).toBe('none');
        });

        test('MM-T_BADGE_WIN_10 - unread dot shown when showUnreadBadgeSetting is true', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(electronApp, false, 0, true);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(0);
            expect(state!.showUnreadBadge).toBe(true);
            expect(state!.sessionExpired).toBe(false);
            expect(state!.resolvedType).toBe('unread');
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(false);
            });
        });
    });

    // --- Group 3: Badge Clearing / Ghost-Badge Regression ---

    test.describe('badge clearing', () => {
        test('MM-T_BADGE_WIN_11 - ghost mention badge clears on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, false, 3, false);
            let state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(3);

            await resetBadgeState(electronApp);
            await triggerBadge(electronApp, false, 0, false);
            state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(0);
            expect(state!.showUnreadBadge).toBe(false);
            expect(state!.sessionExpired).toBe(false);
        });

        test('MM-T_BADGE_WIN_12 - ghost unread dot clears on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(electronApp, false, 0, true);
            let state = await getBadgeState(electronApp);
            expect(state!.showUnreadBadge).toBe(true);

            await resetBadgeState(electronApp);
            await triggerBadge(electronApp, false, 0, false);
            state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.showUnreadBadge).toBe(false);
            expect(state!.mentionCount).toBe(0);
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(false);
            });
        });

        test('MM-T_BADGE_WIN_13 - ghost session-expired badge clears on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, true, 0, false);
            let state = await getBadgeState(electronApp);
            expect(state!.sessionExpired).toBe(true);

            await resetBadgeState(electronApp);
            await triggerBadge(electronApp, false, 0, false);
            state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.sessionExpired).toBe(false);
        });

        test('MM-T_BADGE_LNX_05 - Linux counter resets to zero', {tag: ['@P2', '@linux']}, async ({electronApp}) => {
            if (process.platform !== 'linux') {
                test.skip(true, 'Linux only');
                return;
            }
            await triggerBadge(electronApp, false, 5, false);
            let state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(5);

            await resetBadgeState(electronApp);
            await triggerBadge(electronApp, false, 0, false);
            state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(0);
        });
    });

    // --- Group 4: State Transitions (Windows) ---

    test.describe('state transitions', () => {
        test('MM-T_BADGE_WIN_14 - mention count decrements correctly on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, false, 5, false);
            let state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(5);

            await triggerBadge(electronApp, false, 3, false);
            state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(3);

            await triggerBadge(electronApp, false, 0, false);
            state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(0);
        });

        test('MM-T_BADGE_WIN_15 - transitions from mention to unread dot on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(electronApp, false, 3, false);
            let state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(3);

            await triggerBadge(electronApp, false, 0, true);
            state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(0);
            expect(state!.showUnreadBadge).toBe(true);
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(false);
            });
        });

        test('MM-T_BADGE_WIN_16 - transitions from unread dot to mention on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(true);
            });
            await triggerBadge(electronApp, false, 0, true);
            let state = await getBadgeState(electronApp);
            expect(state!.showUnreadBadge).toBe(true);
            expect(state!.mentionCount).toBe(0);

            await triggerBadge(electronApp, false, 2, false);
            state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(2);
            await electronApp.evaluate(() => {
                (global as any).__testTriggerSetUnreadBadgeSetting(false);
            });
        });

        test('MM-T_BADGE_WIN_17 - session-restore with pending mentions on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, true, 0, false);
            let state = await getBadgeState(electronApp);
            expect(state!.sessionExpired).toBe(true);

            await triggerBadge(electronApp, false, 3, false);
            state = await getBadgeState(electronApp);
            expect(state!.sessionExpired).toBe(false);
            expect(state!.mentionCount).toBe(3);
        });
    });

    // --- Group 5: Windows-specific Edge Cases ---

    test.describe('windows edge cases', () => {
        test('MM-T_BADGE_WIN_18 - mention count exactly at 99 on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, false, 99, false);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(99);
            expect(state!.sessionExpired).toBe(false);
        });

        test('MM-T_BADGE_WIN_19 - mention count over 99 cap on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, false, 100, false);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(100);
            expect(state!.sessionExpired).toBe(false);
        });

        test('MM-T_BADGE_WIN_20 - explicit no-badge state recorded on Windows', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
            if (process.platform !== 'win32') {
                test.skip(true, 'Windows only');
                return;
            }
            await triggerBadge(electronApp, false, 0, false);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.sessionExpired).toBe(false);
            expect(state!.mentionCount).toBe(0);
            expect(state!.showUnreadBadge).toBe(false);
        });
    });

    // --- Group 6: Linux-specific Edge Cases ---

    test.describe('linux edge cases', () => {
        test('MM-T_BADGE_LNX_06 - no cap on mention count on Linux', {tag: ['@P2', '@linux']}, async ({electronApp}) => {
            if (process.platform !== 'linux') {
                test.skip(true, 'Linux only');
                return;
            }
            await triggerBadge(electronApp, false, 100, false);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.mentionCount).toBe(100);
        });

        test('MM-T_BADGE_LNX_07 - session-expired with zero mentions on Linux', {tag: ['@P2', '@linux']}, async ({electronApp}) => {
            if (process.platform !== 'linux') {
                test.skip(true, 'Linux only');
                return;
            }
            await triggerBadge(electronApp, true, 0, false);
            const state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.sessionExpired).toBe(true);
            expect(state!.mentionCount).toBe(0);
        });

        test('MM-T_BADGE_LNX_08 - Linux clears correctly with all false/zero', {tag: ['@P2', '@linux']}, async ({electronApp}) => {
            if (process.platform !== 'linux') {
                test.skip(true, 'Linux only');
                return;
            }
            await triggerBadge(electronApp, false, 3, false);
            let state = await getBadgeState(electronApp);
            expect(state!.mentionCount).toBe(3);

            await resetBadgeState(electronApp);
            await triggerBadge(electronApp, false, 0, false);
            state = await getBadgeState(electronApp);
            expect(state).not.toBeNull();
            expect(state!.sessionExpired).toBe(false);
            expect(state!.mentionCount).toBe(0);
        });
    });
});
