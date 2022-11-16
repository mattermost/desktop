// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ElectronLog} from 'electron-log';

import {MASK_EMAIL, MASK_IPV4, MASK_PATH, MASK_URL, REGEX_EMAIL, REGEX_IPV4, REGEX_PATH_DARWIN, REGEX_PATH_LINUX, REGEX_PATH_WIN32, REGEX_URL} from 'common/constants';

import {truncateString} from './utils';

type ElectronLogHook = ElectronLog['hooks'][number];
type ElectronLogHookCreator = (l: ElectronLog) => ElectronLogHook;

const isDarwin = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
const isWin = process.platform === 'win32';

export const maskMessageDataHook: ElectronLogHookCreator = (logger) => (message, transport) => {
    if (transport !== logger.transports.file) {
        return message;
    }

    for (let i = 0; i < message.data.length; i++) {
        // Specific keywords
        if (message.data[i]?.toLowerCase?.().includes('password')) {
            return false;
        }

        // Emails
        if (REGEX_EMAIL.test(message.data[i])) {
            message.data[i] = message.data[i].replaceAll(RegExp(REGEX_EMAIL, 'gi'), MASK_EMAIL);
        }

        // IP addresses
        if (REGEX_IPV4.test(message.data[i])) {
            message.data[i] = message.data[i].replaceAll(RegExp(REGEX_IPV4, 'gi'), MASK_IPV4);
        }

        // URLs
        if (REGEX_URL.test(message.data[i])) {
            message.data[i] = message.data[i].replaceAll(RegExp(REGEX_URL, 'gi'), MASK_URL);
        }

        // Paths
        if (isDarwin) {
            if (REGEX_PATH_DARWIN.test(message.data[i])) {
                message.data[i] = message.data[i].replaceAll(RegExp(REGEX_PATH_DARWIN, 'gi'), MASK_PATH);
            }
        } else if (isLinux) {
            if (REGEX_PATH_LINUX.test(message.data[i])) {
                message.data[i] = message.data[i].replaceAll(RegExp(REGEX_PATH_LINUX, 'gi'), MASK_PATH);
            }
        } else if (isWin) {
            if (REGEX_PATH_WIN32.test(message.data[i])) {
                message.data[i] = message.data[i].replaceAll(RegExp(REGEX_PATH_WIN32, 'gi'), MASK_PATH);
            }
        }

        // Very long strings will be masked (eg tokens)
        message.data[i] = message.data[i]?.split?.(' ')?.map?.((str: string) => truncateString(str))?.join?.(' ');
    }

    return message;
};

const loggerHooks: (logger: ElectronLog) => ElectronLog['hooks'] = (logger) => [
    maskMessageDataHook(logger),
];

export default loggerHooks;
