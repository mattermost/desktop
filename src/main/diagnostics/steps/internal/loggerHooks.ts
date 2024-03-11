// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MainLogger} from 'electron-log';

import {obfuscateByType} from './obfuscators';

type MainLoggerHook = MainLogger['hooks'][number];
type MainLoggerHookCreator = (l: MainLogger) => MainLoggerHook;

export const maskMessageDataHook: MainLoggerHookCreator = (logger) => (message, transport) => {
    if (transport !== logger.transports.file) {
        return message;
    }

    // iterate the arguments of the log command, eg log.debug(a, b, c, ...);
    for (let i = 0; i < message.data.length; i++) {
        message.data[i] = obfuscateByType(message.data[i]);
    }

    return message;
};

const loggerHooks: (logger: MainLogger) => MainLogger['hooks'] = (logger) => [
    maskMessageDataHook(logger),
];

export default loggerHooks;
