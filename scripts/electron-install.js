// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* global globalThis */

/**
 * Runs electron/install.js after wrapping fetch() so a TypeError: fetch failed
 * prints the URL and undici error.cause. electron/install.js only logs err.stack,
 * which Node does not include cause on.
 */

function printCauseChain(err) {
    let current = err;
    let depth = 0;
    while (current && depth < 8) {
        const code = current.code || current.errno;
        const parts = [`[electron-install] cause[${depth}]: ${current.name || 'Error'}: ${current.message}`];
        if (code) {
            parts.push(`code=${code}`);
        }
        if (current.syscall) {
            parts.push(`syscall=${current.syscall}`);
        }
        if (current.hostname) {
            parts.push(`hostname=${current.hostname}`);
        }
        if (current.address) {
            parts.push(`address=${current.address}`);
        }
        if (current.port) {
            parts.push(`port=${current.port}`);
        }
        if (current.errored) {
            parts.push(`errored=${current.errored}`);
        }
        console.error(parts.join(' '));
        current = current.cause;
        depth += 1;
    }
}

const origFetch = globalThis.fetch;
if (typeof origFetch === 'function') {
    globalThis.fetch = async (url, ...rest) => {
        try {
            return await origFetch(url, ...rest);
        } catch (err) {
            console.error(`[electron-install] fetch failed for ${String(url)}`);
            printCauseChain(err);
            throw err;
        }
    };
}

require(require.resolve('electron/install.js'));
