// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import yargs from 'yargs';

import * as Validator from './Validator';

const supportedArgKeys = [
  'hidden',
  'disable-dev-mode',
  'disableDevMode',
  'data-dir',
  'dataDir',
  'version',
];

export default function parse(args) {
  const validatedArgs = validateSupportedArgs(getSupportedArgs(getParsedArgs(args)));
  return validatedArgs;
}

function getParsedArgs(args) {
  return yargs.
    boolean('hidden').describe('hidden', 'Launch the app in hidden mode.').
    alias('disable-dev-mode', 'disableDevMode').boolean('disable-dev-mode').describe('disable-dev-mode', 'Disable dev mode.').
    alias('data-dir', 'dataDir').string('data-dir').describe('data-dir', 'Set the path to where user data is stored.').
    alias('v', 'version').boolean('v').describe('version', 'Prints the application version.').
    parse(args);
}

function getSupportedArgs(args) {
  return Object.keys(args).
    filter((key) => supportedArgKeys.includes(key)).
    reduce((obj, key) => {
      obj[key] = args[key];
      return obj;
    }, {});
}

function validateSupportedArgs(args) {
  return Validator.validateArgs(args) || {};
}
