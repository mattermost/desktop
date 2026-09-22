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
        // Truthy {} skips getCustomProfileAttributeValues. API PATCH and
        // saveCustomProfileAttribute then leave the user object empty —
        // Cancel re-inits from that map.
        assert.equal(willFetchCpaValues({}), false);
    });

    it('RECEIVED_CPA_VALUES merges endpoint values onto the user map', () => {
        const applyReceivedCpaValues = (existing, incoming) => ({...(existing || {}), ...incoming});
        assert.deepEqual(applyReceivedCpaValues({}, {abc: 'Engineering'}), {abc: 'Engineering'});
        assert.deepEqual(applyReceivedCpaValues(undefined, {abc: 'Engineering'}), {abc: 'Engineering'});
    });

    it('Cancel describe restores the user map, not the unsaved draft', () => {
        // updateSection = setupInitialState(props); describe reads
        // props.user.custom_profile_attributes, not the input draft.
        const describeAfterCancel = (userMap) => userMap?.abc || '';
        assert.equal(describeAfterCancel({abc: 'Engineering'}), 'Engineering');
        assert.equal(describeAfterCancel({}), '');
    });
});
