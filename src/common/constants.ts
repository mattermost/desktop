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
