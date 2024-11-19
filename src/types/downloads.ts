// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum DownloadItemTypeEnum {
    FILE = 'file',
    UPDATE = 'update',
}

export type DownloadItemUpdatedEventState = 'interrupted' | 'progressing';
export type DownloadItemDoneEventState = 'completed' | 'cancelled' | 'interrupted';
export type DownloadItemState = DownloadItemUpdatedEventState | DownloadItemDoneEventState | 'deleted' | 'available';

export type DownloadedItem = {
    type: DownloadItemTypeEnum;
    filename: string;
    state: DownloadItemState;
    progress: number;
    location: string;
    mimeType: string | null;
    addedAt: number;
    receivedBytes: number;
    totalBytes: number;
    bookmark?: string;
    thumbnailData?: string;
}

export type DownloadedItems = Record<string, DownloadedItem>;

export type CoordinatesToJsonType = Omit<DOMRect, 'toJSON'>

export type DownloadsMenuOpenEventPayload = {
    item: DownloadedItem;
    coordinates: CoordinatesToJsonType;
}
