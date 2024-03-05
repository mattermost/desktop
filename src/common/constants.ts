// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DownloadItemTypeEnum} from 'main/downloadsManager';

import type {DownloadedItem} from 'types/downloads';

/**
 * This string includes special characters so that it's not confused with
 * a file that may have the same filename (eg APP_UPDATE)
 */
export const APP_UPDATE_KEY = '#:(APP_UPDATE):#';

export const UPDATE_DOWNLOAD_ITEM: Omit<DownloadedItem, 'filename' | 'state'> = {
    type: 'update' as DownloadItemTypeEnum,
    progress: 0,
    location: '',
    mimeType: null,
    addedAt: 0,
    receivedBytes: 0,
    totalBytes: 0,
};

// Regular expressions
export const REGEX_EMAIL = /[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*/; // based on W3C input type email regex
export const REGEX_IPV4 = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
export const REGEX_URL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

export const REGEX_PATH_WIN32 = /((?:[a-zA-Z]:|[\\/][\\/][\w\s.]+[\\/][\w\s.$]+)[\\/](?:[\w\s.]+[\\/])+)([\w\s.]+)[$'"\s]/;
export const REGEX_PATH_DARWIN = /([/]{1}[a-z0-9.]+)+(\/?)|^([/])/;
export const REGEX_PATH_LINUX = /([/]{1}[a-z0-9.]+)+(\/?)|^([/])/; // same as darwin

export const REGEX_LOG_FILE_LINE = /\[(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}.\d{3})\]\s\[(silly|debug|verbose|info|warn|error)\]\s+(.*)/;

// Masks
export const MASK_EMAIL = 'EMAIL';
export const MASK_IPV4 = 'IPV4';
export const MASK_PATH = 'PATH';
export const MASK_URL = 'URL';

export const LOGS_MAX_STRING_LENGTH = 63;

// We use this URL inside the Diagnostics to check if the computer has internet connectivity
export const IS_ONLINE_ENDPOINT = 'https://community.mattermost.com/api/v4/system/ping';

export const COOKIE_NAME_USER_ID = 'MMUSERID';
export const COOKIE_NAME_CSRF = 'MMCSRF';
export const COOKIE_NAME_AUTH_TOKEN = 'MMAUTHTOKEN';
