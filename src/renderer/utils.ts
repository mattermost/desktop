// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import prettyBytes from 'pretty-bytes';
import type {IntlShape} from 'react-intl';

import type {DownloadedItem} from 'types/downloads';

import {Constants} from './constants';

const prettyBytesConverter = (value: number | string, excludeUnits?: boolean, totalUnits?: string): string => {
    let returnValue = 'N/A';
    if (typeof value === 'number') {
        returnValue = prettyBytes(value);
    } else if (typeof value === 'string') {
        const parsed = parseInt(value, 10);

        if (typeof parsed === 'number') {
            returnValue = prettyBytes(parsed);
        }
    }
    if (excludeUnits && totalUnits === returnValue.split(' ')[1]) {
        return returnValue.split(' ')[0];
    }
    return returnValue;
};

const getFileSizeOrBytesProgress = (item: DownloadedItem) => {
    const totalMegabytes = prettyBytesConverter(item.totalBytes);
    if (item.state === 'progressing') {
        return `${prettyBytesConverter(item.receivedBytes, true, totalMegabytes.split(' ')[1])}/${totalMegabytes}`;
    }
    return `${totalMegabytes}`;
};

const getDownloadingFileStatus = (item: DownloadedItem) => {
    switch (item.state) {
    case 'completed':
        return 'Downloaded';
    case 'deleted':
        return 'Deleted';
    default:
        return 'Cancelled';
    }
};

const getIconClassName = (file: DownloadedItem) => {
    if (file.type === 'update') {
        return 'mattermost';
    }

    if (!file.mimeType) {
        return 'generic';
    }

    // Find thumbnail icon form MIME type
    const fileType = file.mimeType.toLowerCase() as keyof typeof Constants.ICON_NAME_FROM_MIME_TYPE;
    if (fileType in Constants.ICON_NAME_FROM_MIME_TYPE) {
        return Constants.ICON_NAME_FROM_MIME_TYPE[fileType];
    }

    // Fallback to file extension
    const extension = file.location.toLowerCase().split('.').pop() as keyof typeof Constants.ICON_NAME_FROM_EXTENSION;
    if (extension && (extension in Constants.ICON_NAME_FROM_EXTENSION)) {
        return Constants.ICON_NAME_FROM_EXTENSION[extension];
    }

    // use generic icon
    return 'generic';
};

const isImageFile = (file: DownloadedItem): boolean => {
    return file.mimeType?.toLowerCase().startsWith('image/') ?? false;
};

const prettyETA = (ms = 0, intl: IntlShape) => {
    let eta;

    if (ms < Constants.MINUTE_MS) {
        eta = `${Math.round(ms / Constants.SECOND_MS)} ${intl.formatMessage({id: 'renderer.time.sec', defaultMessage: 'sec'})}`;
    } else if (ms < Constants.HOUR_MS) {
        eta = `${Math.round(ms / Constants.MINUTE_MS)} ${intl.formatMessage({id: 'renderer.time.mins', defaultMessage: 'mins'})}`;
    } else {
        eta = `${Math.round(ms / Constants.HOUR_MS)} ${intl.formatMessage({id: 'renderer.time.hours', defaultMessage: 'hours'})}`;
    }
    return `${eta} ${intl.formatMessage({id: 'renderer.downloadsDropdown.remaining', defaultMessage: 'remaining'})}`;
};

export {
    getDownloadingFileStatus,
    getFileSizeOrBytesProgress,
    getIconClassName,
    isImageFile,
    prettyETA,
};
