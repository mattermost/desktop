// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {pipe, compose} from 'common/utils/functions'

const inc = x => x + 1

describe('common/utils/functions', () => {
    describe('pipe', () => {
        it('should pipe 2 arguments', () => {
            expect(pipe(
                1,
                inc,
            )).toBe(2);
        });

        it('should pipe 3 arguments', () => {
            expect(pipe(
                1,
                inc,
                inc,
            )).toBe(3);
        });

        it('should pipe 4 arguments', () => {
            expect(pipe(
                1,
                inc,
                inc,
                inc,
            )).toBe(4);
        });

        it('should pipe 5 arguments', () => {
            expect(pipe(
                1,
                inc,
                inc,
                inc,
                inc,
            )).toBe(5);
        });

        it('should pipe 6 arguments', () => {
            expect(pipe(
                1,
                inc,
                inc,
                inc,
                inc,
                inc,
            )).toBe(6);
        });

        it('should pipe 7 arguments', () => {
            expect(pipe(
                1,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
            )).toBe(7);
        });

        it('should pipe 8 arguments', () => {
            expect(pipe(
                1,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
            )).toBe(8);
        });

        it('should pipe 9 arguments', () => {
            expect(pipe(
                1,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
            )).toBe(9);
        });

        it('should pipe 10 arguments', () => {
            expect(pipe(
                1,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
            )).toBe(10);
        });
    });

    describe('compose', () => {
        it('should compose 2 arguments', () => {
            expect(compose(
                inc,
                inc,
            )(1)).toBe(3);
        });

        it('should compose 3 arguments', () => {
            expect(compose(
                inc,
                inc,
                inc,
            )(1)).toBe(4);
        });

        it('should compose 4 arguments', () => {
            expect(compose(
                inc,
                inc,
                inc,
                inc,
            )(1)).toBe(5);
        });

        it('should compose 5 arguments', () => {
            expect(compose(
                inc,
                inc,
                inc,
                inc,
                inc,
            )(1)).toBe(6);
        });

        it('should compose 6 arguments', () => {
            expect(compose(
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
            )(1)).toBe(7);
        });

        it('should compose 7 arguments', () => {
            expect(compose(
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
            )(1)).toBe(8);
        });

        it('should compose 8 arguments', () => {
            expect(compose(
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
            )(1)).toBe(9);
        });

        it('should compose 9 arguments', () => {
            expect(compose(
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
                inc,
            )(1)).toBe(10);
        });
    });
});
