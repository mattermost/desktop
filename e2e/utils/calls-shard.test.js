// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/*.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {assertCallsSpecsOnShard1} = require('../helpers/assertCallsShard');

const CALLS_SPECS = [
    'specs/calls/calls_functionality.test.ts',
    'specs/calls/calls_plugin_setup.test.ts',
    'specs/calls/keyboard_shortcuts.test.ts',
    'specs/calls/slash_commands.test.ts',
];

describe('assertCallsSpecsOnShard1', () => {
    it('allows unsharded runs', () => {
        assert.doesNotThrow(() => assertCallsSpecsOnShard1(null));
        assert.doesNotThrow(() => assertCallsSpecsOnShard1(undefined));
    });

    it('allows shard 1 (including 1-of-1 CMT)', () => {
        assert.doesNotThrow(() => assertCallsSpecsOnShard1({current: 1, total: 1}));
        assert.doesNotThrow(() => assertCallsSpecsOnShard1({current: 1, total: 3}));
    });

    it('throws on shard 2+', () => {
        assert.throws(
            () => assertCallsSpecsOnShard1({current: 2, total: 3}),
            /Calls specs must run on Playwright shard 1 \(got 2\/3\)/,
        );
    });
});

describe('Calls specs wire the shard-1 guard', () => {
    const e2eRoot = path.join(__dirname, '..');
    for (const rel of CALLS_SPECS) {
        it(`${rel} calls assertCallsSpecsOnShard1 in beforeAll`, () => {
            const src = fs.readFileSync(path.join(e2eRoot, rel), 'utf8');
            assert.match(src, /assertCallsSpecsOnShard1\(testInfo\.config\.shard\)/);
        });
    }
});

describe('workflow does not grep-filter Calls per shard', () => {
    it('every Playwright job uses the same --shard formula and no Calls grepInvert', () => {
        const yml = fs.readFileSync(
            path.join(__dirname, '../../.github/workflows/e2e-functional-template.yml'),
            'utf8',
        );
        const shardFlag = '--shard="${PLAYWRIGHT_SHARD%%-of-*}/${PLAYWRIGHT_SHARD##*-of-}"'; // eslint-disable-line no-template-curly-in-string
        assert.equal(yml.split(shardFlag).length - 1, 3);
        assert.doesNotMatch(yml, /grepInvert|grep-invert|--grep-invert/);
        assert.doesNotMatch(yml, /specs\/calls/);
    });
});
