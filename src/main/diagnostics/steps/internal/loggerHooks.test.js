// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MASK_EMAIL, MASK_PATH} from 'common/constants';

import {maskMessageDataHook} from './loggerHooks';
import {obfuscateByType} from './obfuscators';

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

    it('should return empty "" if the message includes the string "password"', () => {
        const message = {
            data: ['Password: someRandomPassword'],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file');
        expect(result.data[0]).toBe('');
    });

    it('should mask emails', () => {
        const message = {
            data: ['email@test.com email2@test.com'],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
        expect(findOccurrencesInString(MASK_EMAIL, result)).toBe(2);
    });

    it('should mask IPV4 addresses', () => {
        const IPs = ['192.168.20.44', '1.1.1.1', '255.255.255.255'];
        const message = {
            data: [`:${IPs[0]} https://${IPs[1]} networkPc://${IPs[2]}`],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
        expect(IPs.some((ip) => result.includes(ip))).toBe(false);
    });

    it('should mask URLs', () => {
        const URLs = ['http://www.google.com', 'https://community.mattermost.com', 'https://someWebsite.com'];
        const message = {
            data: [`${URLs[0]} https://${URLs[1]} http://${URLs[2]}`],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
        expect(URLs.some((url) => result.includes(url))).toBe(false);
    });

    it('should not allow local prototype pollution', () => {
        const obj = JSON.parse('{"__proto__":["1","2","3","4"]}');
        expect(obj instanceof Array).toBe(false);
        const obf = obfuscateByType(obj);
        expect(obf instanceof Array).toBe(false);
    });

    describe('should mask paths for all OSs', () => {
        it('darwin', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
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
                data: ['C:/Users/user/Desktop/download.pdf C:\\Users\\user\\Desktop\\folder withSpace\\file.txt'],
            };
            const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
            expect(findOccurrencesInString(MASK_PATH, result)).toBe(2);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    it('should truncate very longs substrings', () => {
        const message = {
            data: ['ThisIsAVeryVeryVeryVeryVeryVeryVeryVeryLongStringProbablyAToken'],
        };
        const result = maskMessageDataHook(loggerMock)(message, 'file').data[0];
        expect(result).toBe('This...en');
    });
});
