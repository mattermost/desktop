// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import Joi from '@hapi/joi';
import { join } from 'path';

const defaultOptions =  {
  stripUnknown: true,
}

const boundsInfoSchema = Joi.object({
  x: Joi.number().integer().min(0),
  y: Joi.number().integer().min(0),
  width: Joi.number().integer().min(400).required().default(1000),
  height: Joi.number().integer().min(240).required().default(700),
  maximized: Joi.boolean().default(false),
  fullscreen: Joi.boolean().default(false),
});

export function validateBoundsInfo(data) {
  return validateAgainstSchema(data, boundsInfoSchema);
}

const appStateSchema = Joi.object({
  lastAppVersion: Joi.string(),
  skippedVersion: Joi.string(),
  updateCheckedDate: Joi.string(),
});

export function validateAppState(data) {
  return validateAgainstSchema(data, appStateSchema);
}

const configDataSchema = Joi.object({
  version: Joi.number().min(1).default(1),
  teams: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    url: Joi.string().uri({
      scheme: [
        'http',
        'https',
      ]
    }).required(),
  })).default([]),
  showTrayIcon: Joi.boolean().default(false),
  trayIconTheme: Joi.any().valid('light', 'dark').default('light'),
  minimizeToTray: Joi.boolean().default(false),
  notifications: Joi.object({
    flashWindow: Joi.any().valid(0, 2).default(0),
    bounceIcon: Joi.boolean().default(false),
    bounceIconType: Joi.any().valid('informational', 'critical').default('informational'),
  }),
  showUnreadBadge: Joi.boolean().default(true),
  useSpellChecker: Joi.boolean().default(true),
  enableHardwareAcceleration: Joi.boolean().default(true),
  autostart: Joi.boolean().default(true),
  spellCheckerLocale: Joi.string().regex(/^[a-z]{2}-[A-Z]{2}$/).default('en-US'),
});

export function validateConfigData(data) {
  return validateAgainstSchema(data, configDataSchema);
}

function validateAgainstSchema(data, schema) {
  if (typeof data !== 'object' || !schema) {
    return false;
  }
  const {error, value} = Joi.validate(data, schema, defaultOptions);
  if (error) {
    return false;
  }
  return value;
}
