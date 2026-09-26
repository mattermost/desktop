// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Run: node --test e2e/helpers/semver.test.js

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {isVersionAtLeast} = require('./semver');

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

    it('rejects missing or unparseable versions', () => {
        assert.equal(isVersionAtLeast(undefined, '1.12.0'), false);
        assert.equal(isVersionAtLeast('', '1.12.0'), false);
        assert.equal(isVersionAtLeast('not-a-version', '1.12.0'), false);
    });
});
