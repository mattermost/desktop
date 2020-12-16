// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import yargs from 'yargs';

import {protocols} from '../../electron-builder.json';

import * as Validator from './Validator';

export default function parse(args) {
  return validateArgs(parseArgs(triageArgs(args)));
}

function triageArgs(args) {
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

function parseArgs(args) {
  return yargs.
    alias('dataDir', 'd').string('dataDir').describe('dataDir', 'Set the path to where user data is stored.').
    alias('disableDevMode', 'p').boolean('disableDevMode').describe('disableDevMode', 'Disable development mode. Allows for testing as if it was Production.').
    alias('version', 'v').boolean('version').describe('version', 'Prints the application version.').
    help('help').
    parse(args);
}

function validateArgs(args) {
  return Validator.validateArgs(args) || {};
}
