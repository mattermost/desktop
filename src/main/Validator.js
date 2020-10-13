// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import Joi from '@hapi/joi';

import Utils from '../utils/util';

const defaultOptions = {
  stripUnknown: true,
};
const defaultWindowWidth = 1000;
const defaultWindowHeight = 700;
const minWindowWidth = 400;
const minWindowHeight = 240;

const argsSchema = Joi.object({
  hidden: Joi.boolean(),
  disableDevMode: Joi.boolean(),
  dataDir: Joi.string(),
  version: Joi.boolean(),
});

const boundsInfoSchema = Joi.object({
  x: Joi.number().integer().default(0),
  y: Joi.number().integer().default(0),
  width: Joi.number().integer().min(minWindowWidth).required().default(defaultWindowWidth),
  height: Joi.number().integer().min(minWindowHeight).required().default(defaultWindowHeight),
  maximized: Joi.boolean().default(false),
  fullscreen: Joi.boolean().default(false),
});

const appStateSchema = Joi.object({
  lastAppVersion: Joi.string(),
  skippedVersion: Joi.string(),
  updateCheckedDate: Joi.string(),
});

const configDataSchemaV0 = Joi.object({
  url: Joi.string().required(),
});

const configDataSchemaV1 = Joi.object({
  version: Joi.number().min(1).default(1),
  teams: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    url: Joi.string().required(),
  })).default([]),
  showTrayIcon: Joi.boolean().default(false),
  trayIconTheme: Joi.any().allow('').valid('light', 'dark').default('light'),
  minimizeToTray: Joi.boolean().default(false),
  notifications: Joi.object({
    flashWindow: Joi.any().valid(0, 2).default(0),
    bounceIcon: Joi.boolean().default(false),
    bounceIconType: Joi.any().allow('').valid('informational', 'critical').default('informational'),
  }),
  showUnreadBadge: Joi.boolean().default(true),
  useSpellChecker: Joi.boolean().default(true),
  enableHardwareAcceleration: Joi.boolean().default(true),
  autostart: Joi.boolean().default(true),
  spellCheckerLocale: Joi.string().regex(/^[a-z]{2}-[A-Z]{2}$/).default('en-US'),
});

const configDataSchemaV2 = Joi.object({
  version: Joi.number().min(2).default(2),
  teams: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    url: Joi.string().required(),
    order: Joi.number().integer().min(0),
  })).default([]),
  showTrayIcon: Joi.boolean().default(false),
  trayIconTheme: Joi.any().allow('').valid('light', 'dark').default('light'),
  minimizeToTray: Joi.boolean().default(false),
  notifications: Joi.object({
    flashWindow: Joi.any().valid(0, 2).default(0),
    bounceIcon: Joi.boolean().default(false),
    bounceIconType: Joi.any().allow('').valid('informational', 'critical').default('informational'),
  }),
  showUnreadBadge: Joi.boolean().default(true),
  useSpellChecker: Joi.boolean().default(true),
  enableHardwareAcceleration: Joi.boolean().default(true),
  autostart: Joi.boolean().default(true),
  spellCheckerLocale: Joi.string().regex(/^[a-z]{2}-[A-Z]{2}$/).default('en-US'),
  darkMode: Joi.boolean().default(false),
});

// eg. data['community.mattermost.com'] = { data: 'certificate data', issuerName: 'COMODO RSA Domain Validation Secure Server CA'};
const certificateStoreSchema = Joi.object().pattern(
  Joi.string().uri(),
  Joi.object({
    data: Joi.string(),
    issuerName: Joi.string(),
  })
);

const originPermissionsSchema = Joi.object().keys({
  canBasicAuth: Joi.boolean().default(false), // we can add more permissions later if we want
});

const trustedOriginsSchema = Joi.object({}).pattern(
  Joi.string().uri(),
  Joi.object().keys({
    canBasicAuth: Joi.boolean().default(false), // we can add more permissions later if we want
  }),
);

const allowedProtocolsSchema = Joi.array().items(Joi.string().regex(/^[a-z-]+:$/i));

// validate bounds_info.json
export function validateArgs(data) {
  return validateAgainstSchema(data, argsSchema);
}

// validate bounds_info.json
export function validateBoundsInfo(data) {
  return validateAgainstSchema(data, boundsInfoSchema);
}

// validate app_state.json
export function validateAppState(data) {
  return validateAgainstSchema(data, appStateSchema);
}

// validate v.0 config.json
export function validateV0ConfigData(data) {
  return validateAgainstSchema(data, configDataSchemaV0);
}

// validate v.1 config.json
export function validateV1ConfigData(data) {
  if (Array.isArray(data.teams) && data.teams.length) {
    // first replace possible backslashes with forward slashes
    let teams = data.teams.map(({name, url}) => {
      let updatedURL = url;
      if (updatedURL.includes('\\')) {
        updatedURL = updatedURL.toLowerCase().replace(/\\/gi, '/');
      }
      return {name, url: updatedURL};
    });

    // next filter out urls that are still invalid so all is not lost
    teams = teams.filter(({url}) => Utils.isValidURL(url));

    // replace original teams
    data.teams = teams;
  }
  return validateAgainstSchema(data, configDataSchemaV1);
}

export function validateV2ConfigData(data) {
  if (Array.isArray(data.teams) && data.teams.length) {
    // first replace possible backslashes with forward slashes
    let teams = data.teams.map(({name, url, order}) => {
      let updatedURL = url;
      if (updatedURL.includes('\\')) {
        updatedURL = updatedURL.toLowerCase().replace(/\\/gi, '/');
      }
      return {name, url: updatedURL, order};
    });

    // next filter out urls that are still invalid so all is not lost
    teams = teams.filter(({url}) => Utils.isValidURL(url));

    // replace original teams
    data.teams = teams;
  }
  return validateAgainstSchema(data, configDataSchemaV2);
}

// validate certificate.json
export function validateCertificateStore(data) {
  const jsonData = (typeof data === 'object' ? data : JSON.parse(data));
  return validateAgainstSchema(jsonData, certificateStoreSchema);
}

// validate allowedProtocols.json
export function validateAllowedProtocols(data) {
  return validateAgainstSchema(data, allowedProtocolsSchema);
}

export function validateTrustedOriginsStore(data) {
  const jsonData = (typeof data === 'object' ? data : JSON.parse(data));
  return validateAgainstSchema(jsonData, trustedOriginsSchema);
}

export function validateOriginPermissions(data) {
  const jsonData = (typeof data === 'object' ? data : JSON.parse(data));
  return validateAgainstSchema(jsonData, originPermissionsSchema);
}

function validateAgainstSchema(data, schema) {
  if (typeof data !== 'object') {
    console.error(`Input 'data' is not an object we can validate: ${typeof data}`);
    return false;
  }
  if (!schema) {
    console.error('No schema provided to validate');
    return false;
  }
  const {error, value} = schema.validate(data, defaultOptions);
  if (error) {
    console.error(`Validation failed due to: ${error}`);
    return false;
  }
  return value;
}
