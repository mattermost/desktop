// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MASK_EMAIL, MASK_IPV4, MASK_PATH, MASK_URL} from 'common/constants';

import {maskMessageDataHook} from './loggerHooks';

const loggerMock = {
    transports: {
        file: 'file',
    },
};

function findOccurrencesInString(search, text) {
    const regex = new RegExp(search, 'g');
    return (text.match(regex))?.length || 0;
}

describe('main/diagnostics/loggerHooks', () => {
    it('should mask nothing when it prints only to console', () => {
        const message = {
            data: ['password email@test.com https://192.168.1.1'],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'console').data[0];
        expect(result).toBe(message.data[0]);
    });

    it('should return false if the message includes the string "password"', () => {
        const message = {
            data: ['Password: someRandomPassword'],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file');
        expect(result).toBe(false);
    });

    it('should mask emails', () => {
        const message = {
            data: ['email@test.com email2@test.com'],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
        expect(findOccurrencesInString(MASK_EMAIL, result)).toBe(2);
    });

    it('should mask IPV4 addresses', () => {
        const message = {
            data: [':192.168.1.1 http://192.168.2.2 192.168.3.3'],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
        expect(findOccurrencesInString(MASK_IPV4, result)).toBe(3);
    });

    it('should mask URLs', () => {
        const message = {
            data: ['www.google.com https://community.mattermost.com http://somewebsite.without.tls'],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
        expect(findOccurrencesInString(MASK_URL, result)).toBe(3);
    });

    describe('should mask paths for all OSs', () => {
        it('darwin', () => {
            const message = {
                data: ['/Users/user/Projects/desktop /Users/user/Projects/desktop/file.txt /Users/user/Projects/desktop/folder withSpace/file.txt'],
            };
            const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
            expect(findOccurrencesInString(MASK_PATH, result)).toBe(4);
        });
        it('linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            const message = {
                data: ['/Users/user/Projects/desktop /Users/user/Projects/desktop/file.txt /Users/user/Projects/desktop/folder withSpace/file.txt'],
            };
            const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
            expect(findOccurrencesInString(MASK_PATH, result)).toBe(4);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
        it('windows', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            const message = {
                data: ['C:/Users/user/Desktop/download.pdf C:/Users/user/Desktop/folder withSpace/file.txt'],
            };
            const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
            expect(findOccurrencesInString(MASK_PATH, result)).toBe(3);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });
});
