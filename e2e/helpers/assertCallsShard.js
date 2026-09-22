// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Calls specs must stay on Playwright shard 1 (or unsharded / 1-of-1).
 * `global-setup.ts` only restarts the plugin on shard 1; later shards wait
 * for that restart. A shard shift would race it and flake instead of failing.
 *
 * @param {{current: number, total: number}|null|undefined} shard
 */
function assertCallsSpecsOnShard1(shard) {
    if (!shard || shard.current === 1) {
        return;
    }
    throw new Error(
        `Calls specs must run on Playwright shard 1 (got ${shard.current}/${shard.total}). ` +
        'global-setup.ts only restarts the Calls plugin on shard 1; later shards wait for readiness.',
    );
}

module.exports = {assertCallsSpecsOnShard1};
