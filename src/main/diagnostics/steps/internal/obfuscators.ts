// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MASK_EMAIL, MASK_IPV4, MASK_PATH, MASK_URL, REGEX_EMAIL, REGEX_IPV4, REGEX_PATH_DARWIN, REGEX_PATH_LINUX, REGEX_PATH_WIN32, REGEX_URL} from 'common/constants';

import {truncateString} from './utils';

function maskDataInString(str: string): string {
    let maskedStr = str;
    if (!str || typeof str !== 'string') {
        return str;
    }

    // Specific keywords
    if (str?.toLowerCase?.().includes('password')) {
        return '';
    }

    // Emails
    if (REGEX_EMAIL.test(str)) {
        maskedStr = maskedStr.replaceAll(RegExp(REGEX_EMAIL, 'gi'), MASK_EMAIL);
    }

    // IP addresses
    if (REGEX_IPV4.test(str)) {
        maskedStr = maskedStr.replaceAll(RegExp(REGEX_IPV4, 'gi'), MASK_IPV4);
    }

    // URLs
    if (REGEX_URL.test(str)) {
        maskedStr = maskedStr.replaceAll(RegExp(REGEX_URL, 'gi'), MASK_URL);
    }

    // Paths
    if (process.platform === 'darwin') {
        if (REGEX_PATH_DARWIN.test(str)) {
            maskedStr = maskedStr.replaceAll(RegExp(REGEX_PATH_DARWIN, 'gi'), MASK_PATH);
        }
    } else if (process.platform === 'linux') {
        if (REGEX_PATH_LINUX.test(str)) {
            maskedStr = maskedStr.replaceAll(RegExp(REGEX_PATH_LINUX, 'gi'), MASK_PATH);
        }
    } else if (process.platform === 'win32') {
        if (REGEX_PATH_WIN32.test(str)) {
            maskedStr = maskedStr.replaceAll(RegExp(REGEX_PATH_WIN32, 'gi'), MASK_PATH);
        }
    }

    // Very long strings will be truncated (eg tokens)
    maskedStr = maskedStr.split(/,| |\r?\n/)?.map?.((str: string) => truncateString(str))?.join?.(' ');

    return maskedStr;
}

function maskDataInArray(arr: unknown[]): unknown[] {
    return arr.map((el) => {
        return obfuscateByType(el);
    });
}

function maskDataInObject(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(obj).reduce<Record<string, unknown>>((acc, key) => {
        // Avoid local prototype pollution
        if (key !== '__proto__') {
            acc[key] = obfuscateByType(obj[key]);
        }
        return acc;
    }, {});
}

export function obfuscateByType(item: unknown): unknown {
    const elType = typeof item;
    if (elType === 'string') {
        return maskDataInString(item as string);
    } else if (elType === 'object') {
        if (Array.isArray(item)) {
            return maskDataInArray(item);
        }
        return maskDataInObject(item as Record<string, unknown>);
    }
    return item;
}
