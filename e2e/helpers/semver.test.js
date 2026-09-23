// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Run: node --test e2e/helpers/semver.test.js

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {isVersionAtLeast, numericVersion} = require('./semver');

describe('numericVersion', () => {
    it('parses dotted versions and ignores pre-release suffixes', () => {
        assert.deepEqual(numericVersion('12.0.0-rc1'), [12, 0, 0]);
        assert.deepEqual(numericVersion('1.12.5'), [1, 12, 5]);
        assert.equal(numericVersion('not-a-version'), null);
    });
});

describe('isVersionAtLeast', () => {
    it('treats 12.0.0-rc1 as 12.0.0', () => {
        assert.equal(isVersionAtLeast('12.0.0-rc1', '12.0.0'), true);
        assert.equal(isVersionAtLeast('12.0.0', '11.11.0'), true);
        assert.equal(isVersionAtLeast('11.7.11', '12.0.0'), false);
    });

    it('compares Calls plugin versions', () => {
        assert.equal(isVersionAtLeast('1.12.5', '1.12.0'), true);
        assert.equal(isVersionAtLeast('1.11.0', '1.12.0'), false);
        assert.equal(isVersionAtLeast('0.16.0', '1.12.0'), false);
    });

    it('rejects missing versions', () => {
        assert.equal(isVersionAtLeast(undefined, '1.12.0'), false);
        assert.equal(isVersionAtLeast('', '1.12.0'), false);
    });
});
