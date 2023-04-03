// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log from 'electron-log';

import {Logger} from 'common/log';
import Util from 'common/utils/util';

jest.unmock('common/log');

jest.mock('electron-log', () => ({
    log: jest.fn(),
}));

jest.mock('common/utils/util', () => ({
    shorten: jest.fn(),
}));

describe('common/log', () => {
    describe('withPrefix', () => {
        const logger = new Logger();

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
            logger.withPrefix().log('test item');
            expect(log.log).toBeCalledWith('test item');
        });

        it('should print the log item with a prefix', () => {
            logger.withPrefix('prefix').log('test item');
            expect(log.log).toBeCalledWith('[prefix]', 'test item');
        });

        it('should allow for multiple prefixes', () => {
            logger.withPrefix('prefix1', 'prefix2').log('test item');
            expect(log.log).toBeCalledWith('[prefix1]', '[prefix2]', 'test item');
        });

        it('should truncate really long prefixes', () => {
            logger.withPrefix('a really really really long prefix').log('test item');
            expect(log.log).toBeCalledWith('[a really really r...]', 'test item');
        });
    });
});

