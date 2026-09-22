// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Models 12.0 CPA fetch skip. Run: node --test e2e/helpers/userAttributesCpaCache.test.js

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

/** 12.0 UserSettingsGeneralTab.componentDidMount / ProfilePopoverCustomAttributes useEffect. */
function willFetchCpaValues(customProfileAttributes) {
    return !customProfileAttributes;
}

describe('12.0 custom_profile_attributes fetch skip', () => {
    it('fetches when the user object has no CPA map', () => {
        assert.equal(willFetchCpaValues(undefined), true);
        assert.equal(willFetchCpaValues(null), true);
    });

    it('does not fetch when login left an empty CPA map', () => {
        // Truthy {} skips getCustomProfileAttributeValues. API PATCH is then
        // invisible until reload — T5749 shows the empty placeholder.
        assert.equal(willFetchCpaValues({}), false);
    });
});
