// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log from 'electron-log';

import {Logger} from 'common/log';
import Util from 'common/utils/util';

jest.unmock('common/log');

jest.mock('electron-log', () => ({
    log: jest.fn(),
    transports: {
        file: {
            level: 'info',
        },
        console: {
            level: 'info',
        },
    },
}));

jest.mock('common/utils/util', () => ({
    shorten: jest.fn(),
}));

describe('common/log', () => {
    describe('withPrefix', () => {
        beforeEach(() => {
            Util.shorten.mockImplementation((string) => {
                const maxLength = 20;
                if (string.length >= maxLength) {
                    return `${string.slice(0, maxLength - 3)}...`;
                }
                return string;
            });
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should just print the log item without prefixes if not provided', () => {
            const logger = new Logger();
            logger.log('test item');
            expect(log.log).toBeCalledWith('test item');
        });

        it('should print the log item with a prefix', () => {
            const logger = new Logger('prefix');
            logger.log('test item');
            expect(log.log).toBeCalledWith('[prefix]', 'test item');
        });

        it('should allow for multiple prefixes', () => {
            const logger = new Logger('prefix1', 'prefix2');
            logger.log('test item');
            expect(log.log).toBeCalledWith('[prefix1]', '[prefix2]', 'test item');
        });

        it('should truncate really long prefixes', () => {
            const logger = new Logger('a really really really long prefix');
            logger.log('test item');
            expect(log.log).toBeCalledWith('[a really really r...]', 'test item');
        });
    });
});

