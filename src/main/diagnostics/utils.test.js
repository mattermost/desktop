// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {addDurationToFnReturnObject, toPromise} from './utils';

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
            expect(b.duration).toBeGreaterThan(timeToSleep);
            expect(b.duration).toBeLessThan(timeToSleep + 10);
        });
    });

    describe('toPromise', () => {
        it('should transform a sync function to promise', () => {
            const functionToTransform = () => {
                return 'test';
            };
            expect(toPromise(functionToTransform)()).toHaveProperty('then');
        });
    });
});
