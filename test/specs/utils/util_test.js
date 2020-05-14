// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import url from 'url';
import assert from 'assert';

import Utils from '../../../src/utils/util';

describe('Utils', () => {
  describe('isValidURL', () => {
    it('should be true for a valid web url', () => {
      const testURL = 'https://developers.mattermost.com/';
      assert.equal(Utils.isValidURL(testURL), true);
    });
    it('should be true for a valid, non-https web url', () => {
      const testURL = 'http://developers.mattermost.com/';
      assert.equal(Utils.isValidURL(testURL), true);
    });
    it('should be true for an invalid, self-defined, top-level domain', () => {
      const testURL = 'https://www.example.x';
      assert.equal(Utils.isValidURL(testURL), true);
    });
    it('should be true for a file download url', () => {
      const testURL = 'https://community.mattermost.com/api/v4/files/ka3xbfmb3ffnmgdmww8otkidfw?download=1';
      assert.equal(Utils.isValidURL(testURL), true);
    });
    it('should be true for a permalink url', () => {
      const testURL = 'https://community.mattermost.com/test-channel/pl/pdqowkij47rmbyk78m5hwc7r6r';
      assert.equal(Utils.isValidURL(testURL), true);
    });
    it('should be true for a valid, internal domain', () => {
      const testURL = 'https://mattermost.company-internal';
      assert.equal(Utils.isValidURL(testURL), true);
    });
    it('should be true for a second, valid internal domain', () => {
      const testURL = 'https://serverXY/mattermost';
      assert.equal(Utils.isValidURL(testURL), true);
    });
    it('should be true for a valid, non-https internal domain', () => {
      const testURL = 'http://mattermost.local';
      assert.equal(Utils.isValidURL(testURL), true);
    });
    it('should be true for a valid, non-https, ip address with port number', () => {
      const testURL = 'http://localhost:8065';
      assert.equal(Utils.isValidURL(testURL), true);
    });
  });
  describe('isValidURI', () => {
    it('should be true for a deeplink url', () => {
      const testURL = 'mattermost://community-release.mattermost.com/core/channels/developers';
      assert.equal(Utils.isValidURI(testURL), true);
    });
    it('should be false for a malicious url', () => {
      const testURL = String.raw`mattermost:///" --data-dir "\\deans-mbp\mattermost`;
      assert.equal(Utils.isValidURI(testURL), false);
    });
  });
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

  describe('getHost', () => {
    it('should return the origin of a well formed url', () => {
      const myurl = 'https://mattermost.com/download';
      assert.equal(Utils.getHost(myurl), 'https://mattermost.com');
    });

    it('shoud raise an error on malformed urls', () => {
      const myurl = 'http://example.com:-80/';
      assert.throws(() => Utils.getHost(myurl), Error);
    });
  });
});
