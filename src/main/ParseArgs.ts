// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';
import yargs from 'yargs';

import * as Validator from 'common/Validator';

import type {Args} from 'types/args';

import {protocols} from '../../electron-builder.json';

export default function parse(args: string[]) {
    return validateArgs(parseArgs(triageArgs(args)));
}

function triageArgs(args: string[]) {
    // ensure any args following a possible deeplink are discarded
    if (protocols && protocols[0] && protocols[0].schemes && protocols[0].schemes[0]) {
        const scheme = protocols[0].schemes[0].toLowerCase();
        const deeplinkIndex = args.findIndex((arg) => arg.toLowerCase().includes(`${scheme}:`));
        if (deeplinkIndex !== -1) {
            return args.slice(0, deeplinkIndex + 1);
        }
    }
    return args;
}

// Note that yargs is able to exit the node process when handling
// certain flags, like version or help.
// https://github.com/yargs/yargs/blob/main/docs/api.md#exitprocessenable

// TODO: Translations?

function parseArgs(args: string[]) {
    return yargs().
        alias('dataDir', 'd').
        string('dataDir').
        describe('dataDir', 'Set the path to where user data is stored.').

        alias('disableDevMode', 'p').
        boolean('disableDevMode').
        describe('disableDevMode', 'Disable development mode. Allows for testing as if it was Production.').

        alias('version', 'v').
        boolean('version').
        describe('version', 'Prints the application version.').

        alias('fullscreen', 'f').
        boolean('fullscreen').
        describe('fullscreen', 'Opens the application in fullscreen mode.').

        // Typically, yargs is capable of acquiring the app's version
        // through package.json.  However, for us this is
        // unsuccessful, perhaps due to a complication during the
        // build.  As such, we provide the version manually.
        version(app.getVersion()).
        help('help').
        parse(args) as Args;
}

function validateArgs(args: Args) {
    return Validator.validateArgs(args) || {};
}
