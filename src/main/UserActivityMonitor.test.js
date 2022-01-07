// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserActivityMonitor} from './UserActivityMonitor';

describe('UserActivityMonitor', () => {
    describe('updateIdleTime', () => {
        it('should set idle time to provided value', () => {
            const userActivityMonitor = new UserActivityMonitor();
            const idleTime = Math.round(Date.now() / 1000);
            userActivityMonitor.updateIdleTime(idleTime);
            expect(userActivityMonitor.userIdleTime).toBe(idleTime);
        });
    });

    describe('updateUserActivityStatus', () => {
        let userActivityMonitor;

        beforeEach(() => {
            userActivityMonitor = new UserActivityMonitor();
        });

        it('should set user status to active', () => {
            userActivityMonitor.setActivityState(true);
            expect(userActivityMonitor.userIsActive).toBe(true);
        });
        it('should set user status to inactive', () => {
            userActivityMonitor.setActivityState(false);
            expect(userActivityMonitor.userIsActive).toBe(false);
        });
    });

    describe('sendStatusUpdate', () => {
        let userActivityMonitor;

        beforeEach(() => {
            userActivityMonitor = new UserActivityMonitor();
        });

        it('should emit a non-system triggered status event indicating a user is active', () => {
            userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
                expect(userIsActive && !isSystemEvent).toBe(true);
            });
            userActivityMonitor.setActivityState(true, false);
        });

        it('should emit a non-system triggered status event indicating a user is inactive', () => {
            userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
                expect(!userIsActive && !isSystemEvent).toBe(true);
            });
            userActivityMonitor.setActivityState(false, false);
        });

        it('should emit a system triggered status event indicating a user is active', () => {
            userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
                expect(userIsActive && isSystemEvent).toBe(true);
            });
            userActivityMonitor.setActivityState(true, true);
        });

        it('should emit a system triggered status event indicating a user is inactive', () => {
            userActivityMonitor.on('status', ({userIsActive, isSystemEvent}) => {
                expect(!userIsActive && isSystemEvent).toBe(true);
            });
            userActivityMonitor.setActivityState(false, true);
        });
    });
});
