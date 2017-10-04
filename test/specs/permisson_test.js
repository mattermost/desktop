/* eslint-disable no-unused-expressions */

const fs = require('fs');
const path = require('path');
const env = require('../modules/environment');
const {PermissionManager} = require('../../src/main/permissionRequestHandler');

const permissionFile = path.join(env.userDataDir, 'permission.json');

describe('PermissionManager', function() {
  beforeEach(function(done) {
    fs.unlink(permissionFile, () => {
      done();
    });
  });

  it('should grant a permisson for an origin', function() {
    const ORIGIN = 'origin';
    const PERMISSION = 'permission';
    const manager = new PermissionManager(permissionFile);

    manager.isGranted(ORIGIN, PERMISSION).should.be.false;
    manager.isDenied(ORIGIN, PERMISSION).should.be.false;

    manager.grant(ORIGIN, PERMISSION);

    manager.isGranted(ORIGIN, PERMISSION).should.be.true;
    manager.isDenied(ORIGIN, PERMISSION).should.be.false;

    manager.isGranted(ORIGIN + '_another', PERMISSION).should.be.false;
    manager.isGranted(ORIGIN, PERMISSION + '_another').should.be.false;
  });

  it('should deny a permisson for an origin', function() {
    const ORIGIN = 'origin';
    const PERMISSION = 'permission';
    const manager = new PermissionManager(permissionFile);

    manager.isGranted(ORIGIN, PERMISSION).should.be.false;
    manager.isDenied(ORIGIN, PERMISSION).should.be.false;

    manager.deny(ORIGIN, PERMISSION);

    manager.isGranted(ORIGIN, PERMISSION).should.be.false;
    manager.isDenied(ORIGIN, PERMISSION).should.be.true;

    manager.isDenied(ORIGIN + '_another', PERMISSION).should.be.false;
    manager.isDenied(ORIGIN, PERMISSION + '_another').should.be.false;
  });

  it('should save permissons to the file', function() {
    const ORIGIN = 'origin';
    const PERMISSION = 'permission';
    const manager = new PermissionManager(permissionFile);
    manager.deny(ORIGIN, PERMISSION);
    manager.grant(ORIGIN + '_another', PERMISSION + '_another');
    JSON.parse(fs.readFileSync(permissionFile)).should.deep.equal({
      origin: {
        permission: 'denied'
      },
      origin_another: {
        permission_another: 'granted'
      }
    });
  });

  it('should restore permissions from the file', function() {
    fs.writeFileSync(permissionFile, JSON.stringify({
      origin: {
        permission: 'denied'
      },
      origin_another: {
        permission_another: 'granted'
      }
    }));
    const manager = new PermissionManager(permissionFile);
    manager.isDenied('origin', 'permission').should.be.true;
    manager.isGranted('origin_another', 'permission_another').should.be.true;
  });
});
