// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log from 'electron-log';
import yargs from 'yargs';

import urlUtils from 'common/utils/url';

import {protocols} from '../../electron-builder.json';

import * as Validator from './Validator';

export default function parse() {
    return validateArgs(triageArgs(parseArgs()));
}

function triageArgs(args) {
    // ensure any args following a possible deeplink are discarded
    if (protocols && protocols[0] && protocols[0].schemes && protocols[0].schemes[0]) {
        const scheme = protocols[0].schemes[0].toLowerCase();
        const deeplinkIndex = args._.findIndex((arg) => {
            const url = arg.toLowerCase();
            return url.startsWith(`${scheme}:`) || url.startsWith('http:') || url.startsWith('https:');
        });
        if (deeplinkIndex !== -1) {
            args._ = args._.slice(0, deeplinkIndex + 1);
        }
    }
    return args;
}

function parseArgs() {
    yargs.
        alias('dataDir', 'd').string('dataDir').describe('dataDir', 'Set the path to where user data is stored.').
        alias('disableDevMode', 'p').boolean('disableDevMode').describe('disableDevMode', 'Disable development mode. Allows for testing as if it was Production.').
        alias('version', 'v').boolean('version').describe('version', 'Prints the application version.').
        alias('serverName', 's').string('serverName').describe('serverName', 'Add url a new mattermost server to the configuration').
        alias('otherServerName', 'S').string('otherServerName').describe('otherServerName', 'Add a server that might not be a Mattermost one, this feature is unsupported and you might experience unexpected behaviour.').
        help('help');
    return yargs.argv;
}

function validateArgs(args) {
    return Validator.validateArgs(args) || {};
}

export function getDeeplinkingURL(args, scheme) {
    if (Array.isArray(args) && args.length) {
    // deeplink urls should always be the last argument, but may not be the first (i.e. Windows with the app already running)
        const url = args[args.length - 1];
        if (url && scheme && url.startsWith(scheme) && urlUtils.isValidURI(url)) {
            return url;
        }
    }
    return null;
}

export function getServerURL(args, scheme) {
    if (args._.length === 0) {
        return null;
    }
    const url = args._[args._.length - 1]; // should be the last one
    if (!url) {
        return null;
    }
    if (scheme && url.startsWith(scheme) && urlUtils.isValidURI(url)) {
        log.warn('Found a deeplinking url, will assume https but this might not be right. Please review your configuration');
        const host = url.split(':', 2);
        return `https:${host[1]}`;
    }
    if (url.startsWith('http:') || url.startsWith('https:')) {
        return url;
    }
    return null;
}
