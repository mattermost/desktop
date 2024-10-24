// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';
import {TAB_BAR_HEIGHT} from 'common/utils/constants';

import * as Utils from './utils';

jest.mock('electron', () => ({
    app: {
        getLoginItemSettings: () => ({
            wasOpenedAsHidden: true,
        }),
        getAppPath: () => '/path/to/app',
    },
}));

jest.mock('common/utils/util', () => ({
    runMode: jest.fn(),
}));

jest.mock('path', () => {
    const original = jest.requireActual('path');
    return {
        ...original,
        resolve: (basePath, ...restOfPath) => original.join('/path/to/app/src/main', ...restOfPath),
    };
});
jest.mock('fs', () => ({
    accessSync: jest.fn().mockImplementation(() => {
        throw new Error('file missing');
    }).mockImplementationOnce(() => {}),
    constants: {
        F_OK: 0,
    },
}));

describe('main/utils', () => {
    describe('shouldBeHiddenOnStartup', () => {
        let originalPlatform;

        beforeAll(() => {
            originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
        });

        it('should be hidden on mac when opened as hidden', () => {
            expect(Utils.shouldBeHiddenOnStartup({})).toBe(true);
        });

        afterAll(() => {
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('getWindowBoundaries', () => {
        it('should include tab bar height', () => {
            expect(Utils.getWindowBoundaries({
                getContentBounds: () => ({width: 500, height: 400}),
            })).toStrictEqual({
                x: 0,
                y: TAB_BAR_HEIGHT,
                width: 500,
                height: 400 - TAB_BAR_HEIGHT,
            });
        });
    });

    describe('isStringWithLength', () => {
        it('should return true for valid string', () => {
            expect(Utils.isStringWithLength('string')).toBe(true);
        });
        it('should return false for empty string', () => {
            expect(Utils.isStringWithLength('')).toBe(false);
        });
        it('should return false for invalid inputs', () => {
            expect(
                Utils.isStringWithLength(null) ||
                Utils.isStringWithLength(undefined) ||
                Utils.isStringWithLength(1) ||
                Utils.isStringWithLength({}) ||
                Utils.isStringWithLength(() => {}),
            ).toBe(false);
        });
    });

    describe('getPercentage', () => {
        it('should return 0 if denominator is 0', () => {
            expect(Utils.getPercentage(1, 0)).toBe(0);
        });
        it('should return the correct percentage', () => {
            expect(Utils.getPercentage(2, 4)).toBe(50);
        });
        it('should return the correct percentage as integer', () => {
            expect(Utils.getPercentage(1, 3)).toBe(33);
        });
    });

    describe('readFilenameFromContentDispositionHeader', () => {
        it('should read the filename from the HTTP Content-Disposition header\'s value', () => {
            expect(Utils.readFilenameFromContentDispositionHeader(['attachment; filename="filename.jpg"; foobar'])).toBe('filename.jpg');
        });
    });

    describe('doubleSecToMs', () => {
        it('should convert a double number of seconds to integer milliseconds', () => {
            expect(Utils.doubleSecToMs(1662561807.067542)).toBe(1662561807068);
        });
    });

    describe('shouldIncrementFilename', () => {
        it('should increment filename if file already exists', () => {
            expect(Utils.shouldIncrementFilename('filename.txt')).toBe('filename (1).txt');
        });
    });

    describe('isInsideRectangle', () => {
        it.each([
            [{x: 0, y: 0, width: 1920, height: 1080}, {x: 100, y: 100, width: 1280, height: 720}, true],
            [{x: 0, y: 0, width: 1920, height: 1080}, {x: -100, y: 100, width: 1280, height: 720}, false],
            [{x: 0, y: 0, width: 1920, height: 1080}, {x: 100, y: -100, width: 1280, height: 720}, false],
            [{x: 0, y: 0, width: 1920, height: 1080}, {x: 100, y: 100, width: 2560, height: 720}, false],
            [{x: 0, y: 0, width: 1920, height: 1080}, {x: 100, y: 100, width: 1280, height: 1440}, false],
            [{x: -1920, y: 0, width: 1920, height: 1080}, {x: 100, y: 100, width: 1280, height: 720}, false],
            [{x: -1920, y: 0, width: 1920, height: 1080}, {x: -1820, y: 100, width: 1280, height: 720}, true],
            [{x: 0, y: -1080, width: 1920, height: 1080}, {x: 100, y: -980, width: 1280, height: 720}, true],
        ])('should match case', (a, b, expected) => {
            expect(Utils.isInsideRectangle(a, b)).toBe(expected);
        });
    });
});
