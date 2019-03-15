// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import url from 'url';
import assert from 'assert';

import Utils from '../../../src/utils/util';

describe('Utils', () => {
  describe('isInternalURL', () => {
    it('should be false for different hosts', () => {
      const currentURL = url.parse('http://localhost/team/channel1');
      const targetURL = url.parse('http://example.com/team/channel2');
      const basename = '/';
      assert.equal(Utils.isInternalURL(targetURL, currentURL, basename), false);
    });

    it('should be false for same hosts, non-matching basename', () => {
      const currentURL = url.parse('http://localhost/subpath/team/channel1');
      const targetURL = url.parse('http://localhost/team/channel2');
      const basename = '/subpath';
      assert.equal(Utils.isInternalURL(targetURL, currentURL, basename), false);
    });

    it('should be true for same hosts, matching basename', () => {
      const currentURL = url.parse('http://localhost/subpath/team/channel1');
      const targetURL = url.parse('http://localhost/subpath/team/channel2');
      const basename = '/subpath';
      assert.equal(Utils.isInternalURL(targetURL, currentURL, basename), true);
    });

    it('should be true for same hosts, default basename', () => {
      const currentURL = url.parse('http://localhost/team/channel1');
      const targetURL = url.parse('http://localhost/team/channel2');
      const basename = '/';
      assert.equal(Utils.isInternalURL(targetURL, currentURL, basename), true);
    });

    it('should be true for same hosts, default basename, empty target path', () => {
      const currentURL = url.parse('http://localhost/team/channel1');
      const targetURL = url.parse('http://localhost/');
      const basename = '/';
      assert.equal(Utils.isInternalURL(targetURL, currentURL, basename), true);
    });
  });
});
