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
    for (let depth = 0; current && depth < 8; depth++) {
        const fields = {
            code: current.code || current.errno,
            syscall: current.syscall,
            hostname: current.hostname,
            address: current.address,
            port: current.port,
            errored: current.errored,
        };
        const extras = Object.entries(fields).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`);
        console.error([`[electron-install] cause[${depth}]: ${current.name || 'Error'}: ${current.message}`, ...extras].join(' '));
        current = current.cause;
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
