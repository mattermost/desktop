// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Calls specs must stay on Playwright shard 1 (or unsharded / 1-of-1).
 * `global-setup.ts` only restarts the plugin on shard 1, so a Calls spec on a
 * later shard would race that restart and flake instead of failing.
 *
 * Do not "fix" this with per-shard `--grep` / `grepInvert`. Playwright
 * `--shard=i/n` partitions the post-grep list independently in each job, so
 * filtering Calls on shards 2+ changes the universe and tests run twice or
 * not at all. Keep one grep for every shard; this throw is the tripwire.
 *
 * @param {{current: number, total: number}|null|undefined} shard
 */
function assertCallsSpecsOnShard1(shard) {
    if (!shard || shard.current === 1) {
        return;
    }
    throw new Error(
        `Calls specs must run on Playwright shard 1 (got ${shard.current}/${shard.total}). ` +
        'global-setup.ts only restarts the Calls plugin on shard 1; later shards would race that restart.',
    );
}

module.exports = {assertCallsSpecsOnShard1};
