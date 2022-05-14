// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {throttle, debounce} from 'common/utils/timing';

const sleep = (x) => new Promise((yes) => setTimeout(() => yes(true), x));

describe('common/utils/timing', () => {
    describe('throttle', () => {
        it('should throttle function calls', async () => {
            const spy = jest.fn();
            const throttled = throttle(spy, 300);
            throttled();
            throttled();
            throttled();
            await sleep(350);
            throttled();
            expect(spy).toHaveBeenCalledTimes(3);
        });
    });

    describe('debounce', () => {
        it('should debounce function calls', async () => {
            const spy = jest.fn();
            const debounced = debounce(spy, 300);
            debounced();
            debounced();
            debounced();
            await sleep(350);
            debounced();
            await sleep(350);
            expect(spy).toHaveBeenCalledTimes(2);
        });
    });
});
