// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import assert from 'assert';

import urlUtils from 'common/utils/url';

describe('URL', () => {
    describe('parseURL', () => {
        it('should remove duplicate slashes in a URL when parsing', () => {
            const urlWithExtraSlashes = 'https://mattermost.com//sub//path//example';
            const parsedURL = urlUtils.parseURL(urlWithExtraSlashes);

            assert.strictEqual(parsedURL.toString(), 'https://mattermost.com/sub/path/example');
        });
    });
});
