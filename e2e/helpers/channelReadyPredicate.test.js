// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Models the 12.0 wait mismatch. Run: node --test e2e/helpers/channelReadyPredicate.test.js

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

function isShown(element) {
    if (!element) {
        return false;
    }
    return element.display !== 'none' && element.visibility !== 'hidden' && element.opacity !== '0';
}

function isVisible(element) {
    if (!isShown(element)) {
        return false;
    }
    return element.width > 0 && element.height > 0;
}

function visibleBox(extra = {}) {
    return {display: 'block', visibility: 'visible', opacity: '1', width: 100, height: 24, ...extra};
}

/** Product wait: visible header + visible composer. Hidden leftovers do not count. */
function viewLoaded({header, composer}) {
    return isVisible(header) && isVisible(composer);
}

describe('channel ready wait vs 12.0 PostListRow sentinel', () => {
    const interactiveChannel = {
        header: visibleBox({id: 'channelHeaderTitle'}),
        composer: visibleBox({id: 'post_textbox'}),

        // PostListRow always mounts <div class="loading-screen"> for
        // OLDER_MESSAGES_LOADER. hideAnimation only stops the CSS animation.
        loadingScreen: {display: 'block', visibility: 'visible', opacity: '1', width: 40, height: 16},
    };

    it('header+composer wait treats the sentinel as loaded', () => {
        assert.equal(viewLoaded(interactiveChannel), true);
    });

    it('still waits when header and composer are missing', () => {
        const loading = {
            header: null,
            composer: null,
            loadingScreen: {display: 'block', visibility: 'visible', opacity: '1', width: 100, height: 100},
        };
        assert.equal(viewLoaded(loading), false);
    });

    it('does not treat a hidden leftover header or composer as ready', () => {
        const hidden = {display: 'none', visibility: 'hidden', opacity: '0', width: 0, height: 0};
        assert.equal(viewLoaded({...interactiveChannel, composer: hidden}), false);
        assert.equal(viewLoaded({...interactiveChannel, header: hidden}), false);
    });
});
