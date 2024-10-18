// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Joi from 'joi';

import {Logger} from 'common/log';
import {isValidURL} from 'common/utils/url';
import {TAB_MESSAGING} from 'common/views/View';

import type {AppState} from 'types/appState';
import type {Args} from 'types/args';
import type {ComparableCertificate} from 'types/certificate';
import type {AnyConfig, ConfigV0, ConfigV1, ConfigV2, ConfigV3, ConfigServer} from 'types/config';
import type {DownloadedItems} from 'types/downloads';
import type {SavedWindowState} from 'types/mainWindow';
import type {PermissionType, TrustedOrigin} from 'types/trustedOrigin';

const log = new Logger('Validator');
const defaultOptions = {
    stripUnknown: true,
};
const defaultWindowWidth = 1000;
const defaultWindowHeight = 700;
const minWindowWidth = 400;
const minWindowHeight = 240;

const argsSchema = Joi.object<Args>({
    hidden: Joi.boolean(),
    disableDevMode: Joi.boolean(),
    dataDir: Joi.string(),
    version: Joi.boolean(),
    fullscreen: Joi.boolean(),
});

const boundsInfoSchema = Joi.object<SavedWindowState>({
    x: Joi.number().integer().default(0),
    y: Joi.number().integer().default(0),
    width: Joi.number().integer().min(minWindowWidth).required().default(defaultWindowWidth),
    height: Joi.number().integer().min(minWindowHeight).required().default(defaultWindowHeight),
    maximized: Joi.boolean().default(false),
    fullscreen: Joi.boolean().default(false),
});

const appStateSchema = Joi.object<AppState>({
    lastAppVersion: Joi.string(),
    skippedVersion: Joi.string(),
    updateCheckedDate: Joi.string(),
});

const downloadsSchema = Joi.object<DownloadedItems>().pattern(
    Joi.string(),
    {
        type: Joi.string().valid('file', 'update'),
        filename: Joi.string().allow(null),
        state: Joi.string().valid('interrupted', 'progressing', 'completed', 'cancelled', 'deleted', 'available'),
        progress: Joi.number().min(0).max(100),
        location: Joi.string().allow(''),
        mimeType: Joi.string().allow(null),
        addedAt: Joi.number().min(0),
        receivedBytes: Joi.number().min(0),
        totalBytes: Joi.number().min(0),
        bookmark: Joi.string(),
        thumbnailData: Joi.string(),
    });

const configDataSchemaV0 = Joi.object<ConfigV0>({
    url: Joi.string().required(),
});

const configDataSchemaV1 = Joi.object<ConfigV1>({
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

const configDataSchemaV2 = Joi.object<ConfigV2>({
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
    spellCheckerLocale: Joi.string().default('en-US'),
    spellCheckerURL: Joi.string().allow(null),
    darkMode: Joi.boolean().default(false),
    downloadLocation: Joi.string(),
});

const configDataSchemaV3 = Joi.object<ConfigV3>({
    version: Joi.number().min(3).default(3),
    teams: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        url: Joi.string().required(),
        order: Joi.number().integer().min(0),
        lastActiveTab: Joi.number().integer().min(0).default(0),
        tabs: Joi.array().items(Joi.object({
            name: Joi.string().required(),
            order: Joi.number().integer().min(0),
            isOpen: Joi.boolean(),
        })).default([]),
    })).default([]),
    showTrayIcon: Joi.boolean().default(false),
    trayIconTheme: Joi.any().allow('').valid('light', 'dark', 'use_system').default('use_system'),
    minimizeToTray: Joi.boolean().default(false),
    notifications: Joi.object({
        flashWindow: Joi.any().valid(0, 2).default(0),
        bounceIcon: Joi.boolean().default(false),
        bounceIconType: Joi.any().allow('').valid('informational', 'critical').default('informational'),
    }),
    showUnreadBadge: Joi.boolean().default(true),
    useSpellChecker: Joi.boolean().default(true),
    enableHardwareAcceleration: Joi.boolean().default(true),
    startInFullscreen: Joi.boolean().default(false),
    autostart: Joi.boolean().default(true),
    hideOnStart: Joi.boolean().default(false),
    spellCheckerLocales: Joi.array().items(Joi.string()).default([]),
    spellCheckerURL: Joi.string().allow(null),
    darkMode: Joi.boolean().default(false),
    downloadLocation: Joi.string(),
    lastActiveTeam: Joi.number().integer().min(0).default(0),
    autoCheckForUpdates: Joi.boolean().default(true),
    alwaysMinimize: Joi.boolean(),
    alwaysClose: Joi.boolean(),
    logLevel: Joi.string().default('info'),
    appLanguage: Joi.string().allow(''),
    enableMetrics: Joi.boolean(),
});

// eg. data['community.mattermost.com'] = { data: 'certificate data', issuerName: 'COMODO RSA Domain Validation Secure Server CA'};
const certificateStoreSchema = Joi.object().pattern(
    Joi.string().uri(),
    Joi.object<ComparableCertificate>({
        data: Joi.string(),
        issuerName: Joi.string(),
    }),
);

const originPermissionsSchema = Joi.object<TrustedOrigin>().keys({
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
export function validateArgs(data: Args) {
    return validateAgainstSchema(data, argsSchema);
}

// validate bounds_info.json
export function validateBoundsInfo(data: SavedWindowState | null) {
    return validateAgainstSchema(data, boundsInfoSchema);
}

// validate app_state.json
export function validateAppState(data: AppState) {
    return validateAgainstSchema(data, appStateSchema);
}

// validate downloads.json
export function validateDownloads(data: DownloadedItems) {
    return validateAgainstSchema(data, downloadsSchema);
}

// validate v.0 config.json
export function validateV0ConfigData(data: ConfigV0) {
    return validateAgainstSchema(data, configDataSchemaV0);
}

function cleanURL(url: string): string {
    let updatedURL = url;
    if (updatedURL.includes('\\')) {
        updatedURL = updatedURL.replace(/\\/gi, '/');
    }
    return updatedURL;
}

function cleanServer<T extends {name: string; url: string}>(server: T) {
    return {
        ...server,
        url: cleanURL(server.url),
    };
}

function cleanServerWithViews(server: ConfigServer) {
    return {
        ...cleanServer(server),
        tabs: server.tabs.map((view) => {
            return {
                ...view,
                isOpen: view.name === TAB_MESSAGING ? true : view.isOpen,
            };
        }),
    };
}

function cleanServers<T extends {name: string; url: string}>(servers: T[], func: (server: T) => T) {
    let newServers = servers;
    if (Array.isArray(newServers) && newServers.length) {
        // first replace possible backslashes with forward slashes
        newServers = newServers.map((server) => func(server));

        // next filter out urls that are still invalid so all is not lost
        newServers = newServers.filter(({url}) => isValidURL(url));
    }
    return newServers;
}

// validate v.1 config.json
export function validateV1ConfigData(data: ConfigV1) {
    data.teams = cleanServers(data.teams, cleanServer);
    return validateAgainstSchema(data, configDataSchemaV1);
}

export function validateV2ConfigData(data: ConfigV2) {
    data.teams = cleanServers(data.teams, cleanServer);
    if (data.spellCheckerURL && !isValidURL(data.spellCheckerURL)) {
        log.error('Invalid download location for spellchecker dictionary, removing from config');
        delete data.spellCheckerURL;
    }
    return validateAgainstSchema(data, configDataSchemaV2);
}

export function validateV3ConfigData(data: ConfigV3) {
    data.teams = cleanServers(data.teams, cleanServerWithViews);
    if (data.spellCheckerURL && !isValidURL(data.spellCheckerURL)) {
        log.error('Invalid download location for spellchecker dictionary, removing from config');
        delete data.spellCheckerURL;
    }
    return validateAgainstSchema(data, configDataSchemaV3);
}

export function validateConfigData(data: AnyConfig) {
    switch (data.version) {
    case 3:
        return validateV3ConfigData(data)!;
    case 2:
        return validateV2ConfigData(data)!;
    case 1:
        return validateV1ConfigData(data)!;
    default:
        return validateV0ConfigData(data)!;
    }
}

// validate certificate.json
export function validateCertificateStore(data: string | Record<string, ComparableCertificate>) {
    const jsonData = (typeof data === 'object' ? data : JSON.parse(data));
    return validateAgainstSchema(jsonData, certificateStoreSchema);
}

// validate allowedProtocols.json
export function validateAllowedProtocols(data: string[]) {
    return validateAgainstSchema(data, allowedProtocolsSchema);
}

export function validateTrustedOriginsStore(data: string | Record<PermissionType, TrustedOrigin>) {
    const jsonData: Record<PermissionType, TrustedOrigin> = (typeof data === 'object' ? data : JSON.parse(data));
    return validateAgainstSchema(jsonData, trustedOriginsSchema);
}

export function validateOriginPermissions(data: string | TrustedOrigin) {
    const jsonData: TrustedOrigin = (typeof data === 'object' ? data : JSON.parse(data));
    return validateAgainstSchema(jsonData, originPermissionsSchema);
}

function validateAgainstSchema<T>(data: T, schema: Joi.ObjectSchema<T> | Joi.ArraySchema): T | null {
    if (typeof data !== 'object') {
        log.error(`Input 'data' is not an object we can validate: ${typeof data}`);
        return null;
    }
    if (!schema) {
        log.error('No schema provided to validate');
        return null;
    }
    const {error, value} = schema.validate(data, defaultOptions);
    if (error) {
        log.error(`Validation failed due to: ${error}`);
        return null;
    }
    return value as T;
}
