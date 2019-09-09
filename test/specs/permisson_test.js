// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import path from 'path';

import env from '../modules/environment';
import PermissionManager from '../../src/main/PermissionManager';

const permissionFile = path.join(env.userDataDir, 'permission.json');

const ORIGIN1 = 'https://example.com';
const PERMISSION1 = 'notifications';

const ORIGIN2 = 'https://example2.com';
const PERMISSION2 = 'test';

const DENIED = 'denied';
const GRANTED = 'granted';

describe('PermissionManager', function() {
  beforeEach(function(done) {
    fs.unlink(permissionFile, () => {
      done();
    });
  });

  it('should grant a permission for an origin', function() {
    const manager = new PermissionManager(permissionFile);

    manager.isGranted(ORIGIN1, PERMISSION1).should.be.false;
    manager.isDenied(ORIGIN1, PERMISSION1).should.be.false;

    manager.grant(ORIGIN1, PERMISSION1);

    manager.isGranted(ORIGIN1, PERMISSION1).should.be.true;
    manager.isDenied(ORIGIN1, PERMISSION1).should.be.false;

    manager.isGranted(ORIGIN2, PERMISSION1).should.be.false;
    manager.isGranted(ORIGIN1, PERMISSION2).should.be.false;
  });

  it('should deny a permission for an origin', function() {
    const manager = new PermissionManager(permissionFile);

    manager.isGranted(ORIGIN1, PERMISSION1).should.be.false;
    manager.isDenied(ORIGIN1, PERMISSION1).should.be.false;

    manager.deny(ORIGIN1, PERMISSION1);

    manager.isGranted(ORIGIN1, PERMISSION1).should.be.false;
    manager.isDenied(ORIGIN1, PERMISSION1).should.be.true;

    manager.isDenied(ORIGIN2, PERMISSION1).should.be.false;
    manager.isDenied(ORIGIN1, PERMISSION2).should.be.false;
  });

  it('should save permissions to the file', function() {
    const manager = new PermissionManager(permissionFile);
    manager.deny(ORIGIN1, PERMISSION1);
    manager.grant(ORIGIN2, PERMISSION2);
    JSON.parse(fs.readFileSync(permissionFile)).should.deep.equal({
      [ORIGIN1]: {
        [PERMISSION1]: DENIED,
      },
      [ORIGIN2]: {
        [PERMISSION2]: GRANTED,
      },
    });
  });

  it('should restore permissions from the file', function() {
    fs.writeFileSync(permissionFile, JSON.stringify({
      [ORIGIN1]: {
        [PERMISSION1]: DENIED,
      },
      [ORIGIN2]: {
        [PERMISSION2]: GRANTED,
      },
    }));
    const manager = new PermissionManager(permissionFile);
    manager.isDenied(ORIGIN1, PERMISSION1).should.be.true;
    manager.isGranted(ORIGIN2, PERMISSION2).should.be.true;
  });

  it('should allow permissions for trusted URLs', function() {
    fs.writeFileSync(permissionFile, JSON.stringify({}));
    const manager = new PermissionManager(permissionFile, [ORIGIN1, ORIGIN2]);
    manager.isGranted(ORIGIN1, PERMISSION1).should.be.true;
    manager.isGranted(ORIGIN2, PERMISSION2).should.be.true;
  });
});
