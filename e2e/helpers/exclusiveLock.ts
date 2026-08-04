// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const LOCK_POLL_MS = 250;

function isProcessAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        return code !== 'ESRCH';
    }
}

export async function acquireExclusiveLock(name: string, timeoutMs = 120_000) {
    const lockPath = path.join(os.tmpdir(), `mattermost-desktop-e2e-${name}.lock`);
    const startedAt = Date.now();
    let handle: fs.FileHandle | undefined;

    while (!handle) {
        try {
            handle = await fs.open(lockPath, 'wx');
            await handle.writeFile(JSON.stringify({
                pid: process.pid,
                createdAt: new Date().toISOString(),
            }));
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== 'EEXIST') {
                throw error;
            }

            try {
                const rawLock = await fs.readFile(lockPath, 'utf8');
                const lockInfo = JSON.parse(rawLock) as {pid?: number};
                if (typeof lockInfo.pid === 'number' && !isProcessAlive(lockInfo.pid)) {
                    await fs.rm(lockPath, {force: true});
                    continue;
                }
            } catch {
                await fs.rm(lockPath, {force: true}).catch(() => {});
                continue;
            }

            if (Date.now() - startedAt > timeoutMs) {
                throw new Error(`Timed out acquiring E2E lock: ${name}`);
            }

            await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
        }
    }

    let released = false;
    return async () => {
        if (released) {
            return;
        }
        released = true;
        await handle?.close().catch(() => {});
        await fs.rm(lockPath, {force: true}).catch(() => {});
    };
}
