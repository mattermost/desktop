// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import assert from 'assert';

import UserActivityMonitor from '../../../src/main/UserActivityMonitor';

describe('UserActivityMonitor', () => {
  describe('updateIdleTime', () => {
    it('should set idle time to provided value', () => {
      const userActivityMonitor = new UserActivityMonitor();
      const idleTime = Math.round(Date.now() / 1000);
      userActivityMonitor.updateIdleTime(idleTime);
      assert.equal(userActivityMonitor.userIdleTime, idleTime);
    });
  });

  describe('updateUserActivityStatus', () => {
    let userActivityMonitor;

    beforeEach(() => {
      userActivityMonitor = new UserActivityMonitor();
    });

    it('should set user status to active', () => {
      userActivityMonitor.setActivityState(true);
      assert.equal(userActivityMonitor.userIsActive, true);
    });
    it('should set user status to inactive', () => {
      userActivityMonitor.setActivityState(false);
      assert.equal(userActivityMonitor.userIsActive, false);
    });
  });

  describe('sendStatusUpdate', () => {
    let userActivityMonitor;

    beforeEach(() => {
      userActivityMonitor = new UserActivityMonitor();
    });

    it('should emit a non-system triggered status event indicating a user is active', () => {
      userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
        assert.equal(userIsActive && !isSystemEvent, true);
      });
      userActivityMonitor.setActivityState(true, false);
    });

    it('should emit a non-system triggered status event indicating a user is inactive', () => {
      userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
        assert.equal(!userIsActive && !isSystemEvent, true);
      });
      userActivityMonitor.setActivityState(false, false);
    });

    it('should emit a system triggered status event indicating a user is active', () => {
      userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
        assert.equal(userIsActive && isSystemEvent, true);
      });
      userActivityMonitor.setActivityState(true, true);
    });

    it('should emit a system triggered status event indicating a user is inactive', () => {
      userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
        assert.equal(!userIsActive && isSystemEvent, true);
      });
      userActivityMonitor.setActivityState(false, true);
    });
  });
});
