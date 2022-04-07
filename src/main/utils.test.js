// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {BACK_BAR_HEIGHT, TAB_BAR_HEIGHT} from 'common/utils/constants';
import {runMode} from 'common/utils/util';

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

        it('should include back bar height when specified', () => {
            expect(Utils.getWindowBoundaries({
                getContentBounds: () => ({width: 500, height: 400}),
            }, true)).toStrictEqual({
                x: 0,
                y: TAB_BAR_HEIGHT + BACK_BAR_HEIGHT,
                width: 500,
                height: 400 - TAB_BAR_HEIGHT - BACK_BAR_HEIGHT,
            });
        });
    });

    describe('getLocalURLString', () => {
        it('should return URL relative to current run directory', () => {
            runMode.mockImplementation(() => 'development');
            expect(Utils.getLocalURLString('index.html')).toStrictEqual('file:///path/to/app/dist/renderer/index.html');
        });

        it('should return URL relative to current run directory in production', () => {
            runMode.mockImplementation(() => 'production');
            expect(Utils.getLocalURLString('index.html')).toStrictEqual('file:///path/to/app/renderer/index.html');
        });

        it('should include query string when specified', () => {
            const queryMap = new Map([['key', 'value']]);
            runMode.mockImplementation(() => 'development');
            expect(Utils.getLocalURLString('index.html', queryMap)).toStrictEqual('file:///path/to/app/dist/renderer/index.html?key=value');
        });

        it('should return URL relative to current run directory when using main process', () => {
            runMode.mockImplementation(() => 'development');
            expect(Utils.getLocalURLString('index.html', null, true)).toStrictEqual('file:///path/to/app/dist/index.html');
        });
    });

    describe('shouldHaveBackBar', () => {
        it('should have back bar for custom logins', () => {
            expect(Utils.shouldHaveBackBar('https://server-1.com', 'https://server-1.com/login/sso/saml')).toBe(true);
        });

        it('should not have back bar for regular login', () => {
            expect(Utils.shouldHaveBackBar('https://server-1.com', 'https://server-1.com/login')).toBe(false);
        });
    });
});
