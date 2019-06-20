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
      userActivityMonitor.updateUserActivityStatus(true);
      assert.equal(userActivityMonitor.userIsActive, true);
    });
    it('should set user status to inactive', () => {
      userActivityMonitor.updateUserActivityStatus(false);
      assert.equal(userActivityMonitor.userIsActive, false);
    });
  });

  describe('handleSystemGoingAway', () => {
    it('should set user status to inactive and forceInactive to true', () => {
      const userActivityMonitor = new UserActivityMonitor();
      userActivityMonitor.isActive = true;
      userActivityMonitor.forceInactive = false;
      userActivityMonitor.handleSystemGoingAway();
      assert.equal(!userActivityMonitor.userIsActive && userActivityMonitor.forceInactive, true);
    });
  });

  describe('handleSystemComingBack', () => {
    it('should set user status to active and forceInactive to false', () => {
      const userActivityMonitor = new UserActivityMonitor();
      userActivityMonitor.isActive = false;
      userActivityMonitor.forceInactive = true;
      userActivityMonitor.handleSystemComingBack();
      assert.equal(userActivityMonitor.userIsActive && !userActivityMonitor.forceInactive, true);
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
      userActivityMonitor.updateUserActivityStatus(true, false);
    });

    it('should emit a non-system triggered status event indicating a user is inactive', () => {
      userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
        assert.equal(!userIsActive && !isSystemEvent, true);
      });
      userActivityMonitor.updateUserActivityStatus(false, false);
    });

    it('should emit a system triggered status event indicating a user is active', () => {
      userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
        assert.equal(userIsActive && isSystemEvent, true);
      });
      userActivityMonitor.updateUserActivityStatus(true, true);
    });

    it('should emit a system triggered status event indicating a user is inactive', () => {
      userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
        assert.equal(!userIsActive && isSystemEvent, true);
      });
      userActivityMonitor.updateUserActivityStatus(false, true);
    });
  });
});
