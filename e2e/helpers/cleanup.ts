// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {expect} from '@playwright/test';

/**
 * Wait for Electron's SingletonLock file to be released after app.close().
 *
 * On Windows the lock can survive 1-3 seconds after close because GPU and
 * renderer subprocesses hold it open briefly. On macOS/Linux it releases
 * faster but polling is still safer than assuming it's immediate.
 *
 * If the next test launches before the lock is released, Electron's singleton
 * guard fires and the new instance exits silently — causing the entire test to
 * fail with no useful error.
 */
export async function waitForLockFileRelease(userDataDir: string): Promise<void> {
    const lockFile = path.join(userDataDir, 'SingletonLock');
    await expect.poll(
        () => !fs.existsSync(lockFile),
        {
            message: `SingletonLock not released at ${lockFile}`,
            timeout: process.platform === 'win32' ? 10_000 : 5_000,
            intervals: [100, 200, 500, 1000],
        },
    ).toBe(true);
}
