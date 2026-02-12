// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Event, WebContentsConsoleMessageEventParams} from 'electron';

import type {Logger} from 'common/log';
import {getLevel} from 'common/log';
import {parseURL} from 'common/utils/url';

import {generateHandleConsoleMessage, isCustomProtocol, isMattermostProtocol} from './webContentEventsCommon';

// Mock the electron-builder.json protocols
jest.mock('common/constants', () => ({
    MATTERMOST_PROTOCOL: 'mattermost',
}));

// Mock the log module
jest.mock('common/log', () => ({
    getLevel: jest.fn(),
}));

// Mock the parseURL function
jest.mock('common/utils/url', () => ({
    parseURL: jest.fn(),
}));

const mockGetLevel = getLevel as jest.MockedFunction<typeof getLevel>;
const mockParseURL = parseURL as jest.MockedFunction<typeof parseURL>;

describe('webContentEventsCommon', () => {
    let mockLogger: jest.Mocked<Logger>;
    let mockWcLog: jest.Mocked<Logger>;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock logger
        mockWcLog = {
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            verbose: jest.fn(),
            silly: jest.fn(),
        } as any;

        mockLogger = {
            withPrefix: jest.fn().mockReturnValue(mockWcLog),
        } as any;
    });

    describe('generateHandleConsoleMessage', () => {
        beforeEach(() => {
            mockParseURL.mockReturnValue(undefined);
        });

        it('should create a handler that logs debug messages by default', () => {
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'log',
                message: 'Test debug message',
                sourceId: '/path/to/file.js',
                lineNumber: 42,
            } as any;

            handler(event);

            expect(mockLogger.withPrefix).toHaveBeenCalledWith('renderer');
            expect(mockWcLog.debug).toHaveBeenCalledWith('Test debug message');
        });

        it('should log error messages using error level', () => {
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'error',
                message: 'Test error message',
                sourceId: '/path/to/file.js',
                lineNumber: 42,
            } as any;

            handler(event);

            expect(mockWcLog.error).toHaveBeenCalledWith('Test error message');
            expect(mockWcLog.debug).not.toHaveBeenCalled();
        });

        it('should log warning messages using warn level', () => {
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'warning',
                message: 'Test warning message',
                sourceId: '/path/to/file.js',
                lineNumber: 42,
            } as any;

            handler(event);

            expect(mockWcLog.warn).toHaveBeenCalledWith('Test warning message');
            expect(mockWcLog.debug).not.toHaveBeenCalled();
        });

        it('should include source file and line number when log level is debug', () => {
            mockGetLevel.mockReturnValue('debug');
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'log',
                message: 'Test message',
                sourceId: '/path/to/some/file.js',
                lineNumber: 123,
            } as any;

            handler(event);

            expect(mockWcLog.debug).toHaveBeenCalledWith('Test message', '(file.js:123)');
        });

        it('should include source file and line number when log level is silly', () => {
            mockGetLevel.mockReturnValue('silly');
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'log',
                message: 'Test message',
                sourceId: '/path/to/some/file.js',
                lineNumber: 123,
            } as any;

            handler(event);

            expect(mockWcLog.debug).toHaveBeenCalledWith('Test message', '(file.js:123)');
        });

        it('should not include source file and line number when log level is not debug or silly', () => {
            mockGetLevel.mockReturnValue('info');
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'log',
                message: 'Test message',
                sourceId: '/path/to/some/file.js',
                lineNumber: 123,
            } as any;

            handler(event);

            expect(mockWcLog.debug).toHaveBeenCalledWith('Test message');
        });

        it('should handle error level with source file and line number when debug level is enabled', () => {
            mockGetLevel.mockReturnValue('debug');
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'error',
                message: 'Test error',
                sourceId: '/path/to/error.js',
                lineNumber: 456,
            } as any;

            handler(event);

            expect(mockWcLog.error).toHaveBeenCalledWith('Test error', '(error.js:456)');
        });

        it('should handle warning level with source file and line number when debug level is enabled', () => {
            mockGetLevel.mockReturnValue('silly');
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'warning',
                message: 'Test warning',
                sourceId: '/path/to/warning.js',
                lineNumber: 789,
            } as any;

            handler(event);

            expect(mockWcLog.warn).toHaveBeenCalledWith('Test warning', '(warning.js:789)');
        });

        it('should sanitize host information in console messages', () => {
            mockGetLevel.mockReturnValue('debug');
            const mockParsedURL = new URL('https://example.com/path');
            mockParseURL.mockReturnValue(mockParsedURL);
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'log',
                message: 'Error from example.com: Connection failed',
                sourceId: 'https://example.com/path/file.js',
                lineNumber: 42,
            } as any;

            handler(event);

            expect(mockWcLog.debug).toHaveBeenCalledWith('Error from <host>: Connection failed', '(file.js:42)');
        });

        it('should sanitize host information in source file path when debug level is enabled', () => {
            mockGetLevel.mockReturnValue('debug');
            const mockParsedURL = new URL('https://server.com/path');
            mockParseURL.mockReturnValue(mockParsedURL);

            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'log',
                message: 'Test message',
                sourceId: 'https://server.com/path/file.js',
                lineNumber: 42,
            } as any;

            handler(event);

            expect(mockWcLog.debug).toHaveBeenCalledWith('Test message', '(file.js:42)');
        });

        it('should handle parseURL returning undefined gracefully', () => {
            mockGetLevel.mockReturnValue('debug');
            const handler = generateHandleConsoleMessage(mockLogger);
            const event: Event<WebContentsConsoleMessageEventParams> = {
                level: 'log',
                message: 'Test message with host.com',
                sourceId: 'invalid-url',
                lineNumber: 42,
            } as any;

            handler(event);

            expect(mockWcLog.debug).toHaveBeenCalledWith('Test message with host.com', '(invalid-url:42)');
        });
    });

    describe('isCustomProtocol', () => {
        it('should return false for http URLs', () => {
            expect(isCustomProtocol(new URL('http://example.com'))).toBe(false);
        });

        it('should return false for https URLs', () => {
            expect(isCustomProtocol(new URL('https://example.com'))).toBe(false);
        });

        it('should return false for mattermost protocol URLs', () => {
            expect(isCustomProtocol(new URL('mattermost://server1'))).toBe(false);
        });

        it('should return true for custom protocol URLs', () => {
            expect(isCustomProtocol(new URL('custom://example.com'))).toBe(true);
        });

        it('should return true for file protocol URLs', () => {
            expect(isCustomProtocol(new URL('file:///path/to/file'))).toBe(true);
        });

        it('should return true for ftp protocol URLs', () => {
            expect(isCustomProtocol(new URL('ftp://example.com'))).toBe(true);
        });

        it('should return true for data protocol URLs', () => {
            expect(isCustomProtocol(new URL('data:text/plain,hello'))).toBe(true);
        });

        it('should handle URLs with different case protocols', () => {
            expect(isCustomProtocol(new URL('HTTP://example.com'))).toBe(false);
        });

        it('should handle URLs with different case mattermost protocol', () => {
            expect(isCustomProtocol(new URL('MATTERMOST://server1'))).toBe(false);
        });
    });

    describe('isMattermostProtocol', () => {
        it('should return true for mattermost protocol URLs', () => {
            expect(isMattermostProtocol(new URL('mattermost://server1'))).toBe(true);
        });

        it('should return false for http URLs', () => {
            expect(isMattermostProtocol(new URL('http://example.com'))).toBe(false);
        });

        it('should return false for https URLs', () => {
            expect(isMattermostProtocol(new URL('https://example.com'))).toBe(false);
        });

        it('should return false for other custom protocol URLs', () => {
            expect(isMattermostProtocol(new URL('custom://example.com'))).toBe(false);
        });

        it('should return false for file protocol URLs', () => {
            expect(isMattermostProtocol(new URL('file:///path/to/file'))).toBe(false);
        });

        it('should handle URLs with different case mattermost protocol', () => {
            expect(isMattermostProtocol(new URL('MATTERMOST://server1'))).toBe(true);
        });

        it('should handle mattermost URLs with paths and query parameters', () => {
            expect(isMattermostProtocol(new URL('mattermost://server1/path?param=value'))).toBe(true);
        });

        it('should handle mattermost URLs with different servers', () => {
            expect(isMattermostProtocol(new URL('mattermost://server1'))).toBe(true);
            expect(isMattermostProtocol(new URL('mattermost://server2'))).toBe(true);
            expect(isMattermostProtocol(new URL('mattermost://my-server.com'))).toBe(true);
        });
    });
});
