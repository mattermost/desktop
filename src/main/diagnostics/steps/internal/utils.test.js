// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {addDurationToFnReturnObject, boundsOk, browserWindowVisibilityStatus, truncateString, webContentsCheck} from './utils';

const sleep = (ms) => new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
});

const timeToSleep = 100;

describe('main/diagnostics/utils', () => {
    describe('addDurationToFnReturnObject', () => {
        it('should measure the execution time of a function and include it in the response', async () => {
            const functionToMeasure = async () => {
                await sleep(timeToSleep);
            };
            const fn = addDurationToFnReturnObject(functionToMeasure);
            const b = await fn();
            expect(b.duration).toBeGreaterThan(timeToSleep - 1);
            expect(b.duration).toBeLessThan(timeToSleep * 1.5);
        });
    });

    describe('truncateString', () => {
        it('should truncate very long string', () => {
            const str = 'ThisIsAVeryVeryVeryVeryVeryVeryVeryVeryLongStringProbablyAToken';
            expect(truncateString(str)).toBe('This...en');
        });
    });

    describe('boundsOk', () => {
        const bounds = {
            x: 17,
            y: 42,
            width: 800,
            height: 600,
        };
        const zeroBounds = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        };

        /** TRUE */
        it('should return true if the bounds Rectangle is valid - not strict', () => {
            expect(boundsOk(bounds)).toBe(true);
        });
        it('should return true if the bounds Rectangle is valid - strict', () => {
            expect(boundsOk(bounds, true)).toBe(true);
        });
        it('should return true if the bounds Rectangle is valid - not strict', () => {
            expect(boundsOk(zeroBounds)).toBe(true);
        });

        /** FALSE */
        it('should return false if the bounds Rectangle is invalid - strict', () => {
            expect(boundsOk(zeroBounds, true)).toBe(false);
        });
        it('should return false if the bounds Rectangle is invalid - not strict', () => {
            expect(boundsOk({x: 0, y: 0})).toBe(false);
        });
        it('should return false if the bounds Rectangle is invalid - not strict', () => {
            expect(boundsOk({x: 0, y: 0, width: 0})).toBe(false);
        });
        it('should return false if the bounds Rectangle is invalid - not strict', () => {
            expect(boundsOk('a_string')).toBe(false);
        });
        it('should return false if the bounds Rectangle is invalid - not strict', () => {
            expect(boundsOk(42)).toBe(false);
        });
        it('should return false if the bounds Rectangle is invalid - not strict', () => {
            expect(boundsOk({...bounds, x: '10'})).toBe(false);
        });
    });

    describe('browserWindowVisibilityStatus', () => {
        const bWindow = {
            getBounds: () => ({x: 0, y: 0, width: 800, height: 600}),
            getOpacity: () => 1,
            isDestroyed: () => false,
            isVisible: () => true,
            isEnabled: () => true,
            getBrowserViews: () => [{
                getBounds: () => ({
                    x: 0,
                    y: 0,
                    width: 800,
                    height: 500,
                }),
            }],
        };
        it('should return true if window ok', () => {
            expect(browserWindowVisibilityStatus('testWindow', bWindow).every((check) => check.ok)).toBe(true);
        });
        it('should return false if bounds not ok', () => {
            expect(browserWindowVisibilityStatus('testWindow', {...bWindow, getBounds: () => ({x: -1, y: -1, width: 200, height: 100})}).every((check) => check.ok)).toBe(false);
        });
        it('should return false if opacity is 0', () => {
            expect(browserWindowVisibilityStatus('testWindow', {...bWindow, getOpacity: () => 0.0}).every((check) => check.ok)).toBe(false);
        });
        it('should return false if window is destroyed', () => {
            expect(browserWindowVisibilityStatus('testWindow', {...bWindow, isDestroyed: () => true}).every((check) => check.ok)).toBe(false);
        });
        it('should return false if window is not visible', () => {
            expect(browserWindowVisibilityStatus('testWindow', {...bWindow, isVisible: () => false}).every((check) => check.ok)).toBe(false);
        });
        it('should return false if window is not enabled', () => {
            expect(browserWindowVisibilityStatus('testWindow', {...bWindow, isEnabled: () => false}).every((check) => check.ok)).toBe(false);
        });
        it('should return false if a child browserView has invalid bounds', () => {
            expect(browserWindowVisibilityStatus('testWindow', {
                ...bWindow,
                getBrowserViews: () => [{
                    getBounds: () => ({
                        x: -1,
                        y: -4000,
                        width: 800,
                        height: 500,
                    }),
                }],
            }).every((check) => check.ok)).toBe(false);
        });
    });

    describe('webContentsCheck', () => {
        it('should return true if webContents are ok', () => {
            expect(webContentsCheck({
                isCrashed: () => false,
                isDestroyed: () => false,
                isWaitingForResponse: () => false,
            })).toBe(true);
        });
        it('should return false if webcontents is undefined', () => {
            expect(webContentsCheck()).toBe(false);
        });
        it('should return false if webContents has crashed', () => {
            expect(webContentsCheck({
                isCrashed: () => true,
                isDestroyed: () => false,
                isWaitingForResponse: () => false,
            })).toBe(false);
        });
        it('should return false if webContents is destroyed', () => {
            expect(webContentsCheck({
                isCrashed: () => false,
                isDestroyed: () => true,
                isWaitingForResponse: () => false,
            })).toBe(false);
        });
        it('should return false if webContents is waiting for response', () => {
            expect(webContentsCheck({
                isCrashed: () => false,
                isDestroyed: () => false,
                isWaitingForResponse: () => true,
            })).toBe(false);
        });
    });
});
