// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Utils, {escapeRegex} from 'common/utils/util';

describe('common/utils/util', () => {
    describe('shorten', () => {
        it('should shorten based on max', () => {
            const string = '123456789012345678901234567890';
            expect(Utils.shorten(string, 10)).toBe('1234567...');
        });
        it('should use DEFAULT_MAX for max < 4', () => {
            const string = '123456789012345678901234567890';
            expect(Utils.shorten(string, 3)).toBe('12345678901234567...');
        });
    });

    describe('isVersionGreaterThanOrEqualTo', () => {
        test('should consider two empty versions as equal', () => {
            const a = '';
            const b = '';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
        });

        test('should consider different strings without components as equal', () => {
            const a = 'not a server version';
            const b = 'also not a server version';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
        });

        test('should consider different malformed versions normally (not greater than case)', () => {
            const a = '1.2.3';
            const b = '1.2.4';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(false);
        });

        test('should consider different malformed versions normally (greater than case)', () => {
            const a = '1.2.4';
            const b = '1.2.3';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
        });

        test('should work correctly for  different numbers of digits', () => {
            const a = '10.0.1';
            const b = '4.8.0';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
        });

        test('should consider an empty version as not greater than or equal', () => {
            const a = '';
            const b = '4.7.1.dev.c51676437bc02ada78f3a0a0a2203c60.true';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(false);
        });

        test('should consider the same versions equal', () => {
            const a = '4.7.1.dev.c51676437bc02ada78f3a0a0a2203c60.true';
            const b = '4.7.1.dev.c51676437bc02ada78f3a0a0a2203c60.true';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
        });

        test('should consider different release versions (not greater than case)', () => {
            const a = '4.7.0.12.c51676437bc02ada78f3a0a0a2203c60.true';
            const b = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(false);
        });

        test('should consider different release versions (greater than case)', () => {
            const a = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
            const b = '4.7.0.12.c51676437bc02ada78f3a0a0a2203c60.true';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
        });

        test('should consider different build numbers unequal', () => {
            const a = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
            const b = '4.7.1.13.c51676437bc02ada78f3a0a0a2203c60.true';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(false);
        });

        test('should ignore different config hashes', () => {
            const a = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
            const b = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c61.true';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
        });

        test('should ignore different licensed statuses', () => {
            const a = '4.7.1.13.c51676437bc02ada78f3a0a0a2203c60.false';
            const b = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
            expect(Utils.isVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
        });
    });

    describe('boundsDiff', () => {
        it('diff', () => {
            const base = {
                x: 0,
                y: 0,
                width: 400,
                height: 200,
            };

            const actual = {
                x: 100,
                y: -100,
                width: 600,
                height: 100,
            };

            const diff = {
                x: -100,
                y: 100,
                width: -200,
                height: 100,
            };

            expect(Utils.boundsDiff(base, actual)).toEqual(diff);
        });
    });

    describe('escapeRegex', () => {
        it('should escape special chars in string when used inside regex', () => {
            const str = 'Language C++';
            const regex = `${escapeRegex(str)}___VIEW_[A-Z]+`;
            expect(new RegExp(regex).test('Language C++___VIEW_ABCDEF')).toBe(true);
        });
    });
});
