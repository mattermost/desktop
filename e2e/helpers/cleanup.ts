// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {expect} from '@playwright/test';

/**
 * On Windows, the SingletonLock file survives for 1-3 seconds after
 * app.close() because the GPU and renderer subprocesses hold it open.
 * If the next test launches before the lock is released, Electron's singleton
 * guard fires and the new instance exits silently — causing the entire test to
 * fail with no useful error.
 *
 * macOS and Linux: app.close() is sufficient, no polling needed.
 */
export async function waitForLockFileRelease(userDataDir: string): Promise<void> {
    if (process.platform !== 'win32') {
        return;
    }
    const lockFile = path.join(userDataDir, 'SingletonLock');
    await expect.poll(
        () => !fs.existsSync(lockFile),
        {
            message: `SingletonLock not released at ${lockFile}`,
            timeout: 10_000,
            intervals: [200, 500, 1000],
        },
    ).toBe(true);
}
