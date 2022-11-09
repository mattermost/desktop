// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DownloadedItem} from 'types/downloads';

import {DownloadItemTypeEnum} from 'main/downloadsManager';

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
export const REGEX_URL = /[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&//=]*/;

export const REGEX_PATH_WIN32 = /(?:[a-z]:)?[/\\](?:[./\\ ](?![./\\\n])|[^<>:"|?*./\\ \n])+[a-zA-Z0-9]./;
export const REGEX_PATH_DARWIN = /([/]{1}[a-z0-9.]+)+(\/?)|^([/])/;
export const REGEX_PATH_LINUX = /([/]{1}[a-z0-9.]+)+(\/?)|^([/])/; // same as darwin

// Masks
export const MASK_EMAIL = 'EMAIL_ADDRESS';
export const MASK_IPV4 = 'IPV4_ADDRESS';
export const MASK_PATH = 'LOCAL_PATH';
export const MASK_URL = 'URL';
