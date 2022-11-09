// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {addDurationToFnReturnObject, truncateString} from './utils';

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
});
