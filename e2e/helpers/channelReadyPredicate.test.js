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

/** Spinner-first wait used by waitForChannelPostListLoaded before this fix. */
function oldPostListLoaded({header, composer, loadingScreen}) {
    if (isShown(loadingScreen)) {
        return false;
    }
    return Boolean(header && composer);
}

/** Product wait: header + composer means the channel is interactive. */
function viewLoaded({header, composer, loadingScreen}) {
    if (header && composer) {
        return true;
    }
    if (isVisible(loadingScreen)) {
        return false;
    }
    return Boolean(header && composer);
}

describe('channel ready wait vs 12.0 PostListRow sentinel', () => {
    const interactiveChannel = {
        header: {id: 'channelHeaderTitle'},
        composer: {id: 'post_textbox'},

        // PostListRow always mounts <div class="loading-screen"> for
        // OLDER_MESSAGES_LOADER. hideAnimation only stops the CSS animation.
        loadingScreen: {display: 'block', visibility: 'visible', opacity: '1', width: 40, height: 16},
    };

    it('old spinner-first probe stays false after the composer is ready', () => {
        assert.equal(oldPostListLoaded(interactiveChannel), false);
    });

    it('header+composer wait treats the sentinel as loaded', () => {
        assert.equal(viewLoaded(interactiveChannel), true);
    });

    it('still waits when header and composer are missing', () => {
        const loading = {
            header: null,
            composer: null,
            loadingScreen: {display: 'block', visibility: 'visible', opacity: '1', width: 100, height: 100},
        };
        assert.equal(oldPostListLoaded(loading), false);
        assert.equal(viewLoaded(loading), false);
    });
});
