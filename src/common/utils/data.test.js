// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {by, duad} from 'common/utils/data';

describe('common/utils/data', () => {
    describe('by', () => {
        it('should sort arrays of objects', () => {
            const source = [{value: 3}, {value: 2}, {value: 1}];
            const result = source.sort(by((x) => x.value));
            expect(result.length).toBe(3);
            expect(result[0].value).toBe(1);
            expect(result[1].value).toBe(2);
            expect(result[2].value).toBe(3);
        });
    });

    describe('duad', () => {
        it('should create an array of exactly 2 elements', () => {
            const result = duad(1, '2');
            expect(result.length).toBe(2);
            expect(result[0]).toBe(1);
            expect(result[1]).toBe('2');
        });
    });
});
