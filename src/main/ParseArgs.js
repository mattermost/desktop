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
    const scheme = protocols[0].schemes[0];
    const deeplinkIndex = args.findIndex((arg) => arg.includes(`${scheme}:`));
    if (deeplinkIndex !== -1) {
      return args.slice(0, deeplinkIndex + 1);
    }
  }
  return args;
}

function parseArgs(args) {
  return yargs.
    boolean('hidden').describe('hidden', 'Launch the app in hidden mode.').
    alias('disable-dev-mode', 'disableDevMode').boolean('disable-dev-mode').describe('disable-dev-mode', 'Disable dev mode.').
    alias('data-dir', 'dataDir').string('data-dir').describe('data-dir', 'Set the path to where user data is stored.').
    alias('v', 'version').boolean('v').describe('version', 'Prints the application version.').
    parse(args);
}

function validateArgs(args) {
  return Validator.validateArgs(args) || {};
}
