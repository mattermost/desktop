// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import assert from 'assert';

import TrustedOriginsStore, {BASIC_AUTH_PERMISSION} from '../../../src/main/trustedOrigins.js';
import {objectFromEntries} from '../../../src/utils/objects.js';

function mockTOS(fileName, returnvalue) {
  const tos = new TrustedOriginsStore(fileName);
  tos.readFromFile = () => {
    return returnvalue;
  };
  return tos;
}

describe('Trusted Origins', () => {
  describe('validate load', () => {
    it('should be empty if there is no file', () => {
      const tos = mockTOS('emptyfile', null);
      tos.load();
      assert.deepEqual(tos.data.size, 0);
    });

    it('should throw an error if data isn\'t an object', () => {
      const tos = mockTOS('notobject', 'this is not my object!');

      assert.throws(tos.load, SyntaxError);
    });

    it('should throw an error if data isn\'t in the expected format', () => {
      const tos = mockTOS('badobject', '{"https://mattermost.com": "this is not my object!"}');
      assert.throws(tos.load, /^Error: Provided TrustedOrigins file does not validate, using defaults instead\.$/);
    });

    it('should drop keys that aren\'t urls', () => {
      const tos = mockTOS('badobject2', '{"this is not an uri": {"canBasicAuth": true}}');
      tos.load();
      assert.equal(typeof tos.data['this is not an uri'], 'undefined');
    });

    it('should contain valid data if everything goes right', () => {
      const value = {
        'https://mattermost.com': {
          canBasicAuth: true,
        }};
      const tos = mockTOS('okfile', JSON.stringify(value));
      tos.load();
      assert.deepEqual(objectFromEntries(tos.data.entries()), value);
    });
  });
  describe('validate testing permissions', () => {
    const value = {
      'https://mattermost.com': {
        canBasicAuth: true,
      },
      'https://notmattermost.com': {
        canBasicAuth: false,
      },
    };
    const tos = mockTOS('permission_test', JSON.stringify(value));
    tos.load();
    it('tos should contain 2 elements', () => {
      assert.equal(tos.data.size, 2);
    });
    it('should say ok if the permission is set', () => {
      assert.equal(tos.checkPermission('https://mattermost.com', BASIC_AUTH_PERMISSION), true);
    });
    it('should say ko if the permission is set to false', () => {
      assert.equal(tos.checkPermission('https://notmattermost.com', BASIC_AUTH_PERMISSION), false);
    });
    it('should say ko if the uri is not set', () => {
      assert.equal(tos.checkPermission('https://undefined.com', BASIC_AUTH_PERMISSION), false);
    });
  });

  describe('validate deleting permissions', () => {
    const value = {
      'https://mattermost.com': {
        canBasicAuth: true,
      },
      'https://notmattermost.com': {
        canBasicAuth: false,
      },
    };
    const tos = mockTOS('permission_test', JSON.stringify(value));
    tos.load();
    it('deleting revokes access', () => {
      assert.equal(tos.checkPermission('https://mattermost.com', BASIC_AUTH_PERMISSION), true);
      tos.delete('https://mattermost.com');
      assert.equal(tos.checkPermission('https://mattermost.com', BASIC_AUTH_PERMISSION), false);
    });
  });
});