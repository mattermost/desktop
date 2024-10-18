// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, ipcMain, powerMonitor} from 'electron';

import {EMIT_CONFIGURATION, METRICS_RECEIVE, METRICS_REQUEST, METRICS_SEND} from 'common/communication';
import Config from 'common/config';

import {PerformanceMonitor} from './performanceMonitor';

jest.mock('electron', () => ({
    app: {
        getAppMetrics: jest.fn(),
    },
    ipcMain: {
        on: jest.fn(),
        off: jest.fn(),
    },
    powerMonitor: {
        on: jest.fn(),
    },
}));

jest.mock('common/config', () => ({
    enableMetrics: true,
}));

describe('main/performanceMonitor', () => {
    let makeWebContents;
    beforeAll(() => {
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');
        jest.spyOn(global, 'clearInterval');
    });

    beforeEach(() => {
        app.getAppMetrics.mockReturnValue([]);

        let cb;
        ipcMain.on.mockImplementation((channel, listener) => {
            if (channel === METRICS_RECEIVE) {
                cb = listener;
            }
        });

        makeWebContents = (id, resolve) => ({
            send: jest.fn().mockImplementation((channel, arg1, arg2) => {
                if (channel === METRICS_REQUEST) {
                    cb({sender: {id}}, arg1, {serverId: arg2, cpu: id, memory: id * 100});
                }
                if (channel === METRICS_SEND) {
                    resolve(arg1);
                }
            }),
            on: (_, listener) => listener(),
            id,
        });
    });

    afterEach(() => {
        Config.enableMetrics = true;
    });

    it('should start and stop with config changes', () => {
        let emitConfigCb;
        ipcMain.on.mockImplementation((channel, listener) => {
            if (channel === EMIT_CONFIGURATION) {
                emitConfigCb = listener;
            }
        });

        const performanceMonitor = new PerformanceMonitor();
        performanceMonitor.init();
        expect(setInterval).toHaveBeenCalled();

        Config.enableMetrics = false;
        emitConfigCb();
        expect(clearInterval).toHaveBeenCalled();

        Config.enableMetrics = true;
        emitConfigCb();
        expect(setInterval).toHaveBeenCalledTimes(2);
    });

    it('should start and stop with power monitor changes', () => {
        const listeners = new Map();
        powerMonitor.on.mockImplementation((channel, listener) => {
            listeners.set(channel, listener);
        });

        const performanceMonitor = new PerformanceMonitor();
        performanceMonitor.init();
        expect(setInterval).toHaveBeenCalled();

        listeners.get('suspend')();
        expect(clearInterval).toHaveBeenCalled();

        setInterval.mockClear();
        clearInterval.mockClear();

        listeners.get('resume')();
        expect(setInterval).toHaveBeenCalled();

        listeners.get('lock-screen')();
        expect(clearInterval).toHaveBeenCalled();

        setInterval.mockClear();
        clearInterval.mockClear();

        listeners.get('unlock-screen')();
        expect(setInterval).toHaveBeenCalled();

        listeners.get('speed-limit-change')(50);
        expect(clearInterval).toHaveBeenCalled();

        setInterval.mockClear();
        clearInterval.mockClear();

        listeners.get('speed-limit-change')(100);
        expect(setInterval).toHaveBeenCalled();
    });

    describe('init', () => {
        it('should not start until init', () => {
            const performanceMonitor = new PerformanceMonitor();
            expect(setInterval).not.toHaveBeenCalled();

            performanceMonitor.init();
            expect(setInterval).toHaveBeenCalled();
        });

        it('should run app metrics for node on init', () => {
            const performanceMonitor = new PerformanceMonitor();
            performanceMonitor.init();
            expect(app.getAppMetrics).toHaveBeenCalled();
        });

        it('should not start if disabled by config', () => {
            Config.enableMetrics = false;

            const performanceMonitor = new PerformanceMonitor();
            expect(setInterval).not.toHaveBeenCalled();

            performanceMonitor.init();
            expect(setInterval).not.toHaveBeenCalled();
        });
    });

    describe('registerView', () => {
        it('should send metrics to registered server views', async () => {
            const performanceMonitor = new PerformanceMonitor();
            performanceMonitor.init();

            const sendValue = new Promise((resolve) => {
                performanceMonitor.registerServerView('view-1', makeWebContents(1, resolve), 'server-1');
            });

            jest.runOnlyPendingTimers();

            expect(await sendValue).toEqual(new Map([['view-1', {cpu: 1, memory: 100, serverId: 'server-1'}]]));
        });

        it('should send metrics for other tabs to registered server views', async () => {
            const performanceMonitor = new PerformanceMonitor();
            performanceMonitor.init();

            const sendValue = new Promise((resolve) => {
                performanceMonitor.registerServerView('view-1', makeWebContents(1, resolve), 'server-1');
                performanceMonitor.registerView('view-2', makeWebContents(2, resolve), 'server-1');
            });

            jest.runOnlyPendingTimers();

            expect(await sendValue).toEqual(new Map([['view-2', {cpu: 2, memory: 200, serverId: 'server-1'}], ['view-1', {cpu: 1, memory: 100, serverId: 'server-1'}]]));
        });

        it('should not send metrics for tabs of other servers to registered server views', async () => {
            const performanceMonitor = new PerformanceMonitor();
            performanceMonitor.init();

            const sendValue = new Promise((resolve) => {
                performanceMonitor.registerServerView('view-1', makeWebContents(1, resolve), 'server-1');
                performanceMonitor.registerView('view-2', makeWebContents(2, resolve), 'server-2');
            });

            jest.runOnlyPendingTimers();

            expect(await sendValue).toEqual(new Map([['view-1', {cpu: 1, memory: 100, serverId: 'server-1'}]]));
        });

        it('should always include node metrics', async () => {
            app.getAppMetrics.mockReturnValue([{
                name: 'main',
                type: 'Browser',
                cpu: {percentCPUUsage: 50},
                memory: {privateBytes: 1000},
            }]);

            const performanceMonitor = new PerformanceMonitor();
            performanceMonitor.init();

            const sendValue = new Promise((resolve) => {
                performanceMonitor.registerServerView('view-1', makeWebContents(1, resolve), 'server-1');
            });

            jest.runOnlyPendingTimers();

            expect(await sendValue).toEqual(new Map([['view-1', {cpu: 1, memory: 100, serverId: 'server-1'}], ['main', {cpu: 50, memory: 1000}]]));
        });

        it('should never include tabs from getAppMetrics', async () => {
            app.getAppMetrics.mockReturnValue([{
                name: 'other-server',
                type: 'Tab',
                cpu: {percentCPUUsage: 50},
                memory: {privateBytes: 1000},
            }]);

            const performanceMonitor = new PerformanceMonitor();
            performanceMonitor.init();

            const sendValue = new Promise((resolve) => {
                performanceMonitor.registerServerView('view-1', makeWebContents(1, resolve), 'server-1');
            });

            jest.runOnlyPendingTimers();

            expect(await sendValue).toEqual(new Map([['view-1', {cpu: 1, memory: 100, serverId: 'server-1'}]]));
        });
    });

    describe('unregisterView', () => {
        it('should not send after the view is removed', async () => {
            const performanceMonitor = new PerformanceMonitor();
            performanceMonitor.init();

            const sendValue = new Promise((resolve) => {
                performanceMonitor.registerServerView('view-1', makeWebContents(1, resolve), 'server-1');
                performanceMonitor.registerServerView('view-2', makeWebContents(2, resolve), 'server-1');
            });

            jest.runOnlyPendingTimers();
            expect(await sendValue).toEqual(new Map([['view-1', {cpu: 1, memory: 100, serverId: 'server-1'}], ['view-2', {cpu: 2, memory: 200, serverId: 'server-1'}]]));

            // Have to re-register to make sure the promise resolves
            const sendValue2 = new Promise((resolve) => {
                performanceMonitor.unregisterView(2);
                performanceMonitor.registerServerView('view-1', makeWebContents(1, resolve), 'server-1');
            });

            jest.runOnlyPendingTimers();
            expect(await sendValue2).toEqual(new Map([['view-1', {cpu: 1, memory: 100, serverId: 'server-1'}]]));
        });
    });
});
