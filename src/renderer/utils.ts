// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ConfigDownloadItem} from 'types/config';

const bytesToMegabytes = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(1);
};

const getETA = (item: ConfigDownloadItem) => {
    const elapsedTime = Math.round((new Date().getTime() - Math.floor(item.addedAt * 1000)) / 3600);
    return elapsedTime;
};

const bytesToMegabytesConverter = (value: number | string): string => {
    if (typeof value === 'number') {
        return bytesToMegabytes(value);
    }
    if (typeof value === 'string') {
        const parsed = parseInt(value, 10);

        if (typeof parsed === 'number') {
            return bytesToMegabytes(parsed);
        }
    }
    return 'N/A';
};

const getFileSizeOrBytesProgress = (item: ConfigDownloadItem) => {
    const totalMegabytes = bytesToMegabytesConverter(item.totalBytes);
    if (item.state === 'progressing') {
        return `${bytesToMegabytesConverter(item.receivedBytes)}/${totalMegabytes} MB`;
    }
    return `${totalMegabytes} MB`;
};

const getDownloadingFileStatus = (item: ConfigDownloadItem) => {
    switch (item.state) {
    case 'progressing':
        return `${getETA(item)} elapsed`;
    case 'completed':
        return 'Downloaded';
    case 'deleted':
        return 'Deleted';
    default:
        return 'Cancelled';
    }
};

export {
    bytesToMegabytesConverter,
    getDownloadingFileStatus,
    getFileSizeOrBytesProgress,
};
