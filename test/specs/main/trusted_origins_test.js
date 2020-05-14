// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import assert from 'assert';

import TrustedOriginsStore from '../../../src/main/trustedOrigins.js';

describe('Trusted Origins', () => {
  describe('validate load', () => {
    it('should be empty if there is no file', () => {
      const tos = new TrustedOriginsStore('emptyfile');
      tos.readFromFile = () => {
        return null;
      };

      tos.load();
      assert.deepEqual(tos.data, {});
    });
    it('should throw an error if data doesn\'t validate', () => {
      const tos = new TrustedOriginsStore('emptyfile');
      tos.readFromFile = () => {
        return 'this is not my object!';
      };

      assert.throws(tos.load, /^Error: Provided TrustedOrigins file does not validate, using defaults instead\.$/);
    });
  });
});