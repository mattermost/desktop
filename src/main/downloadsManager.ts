// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';
import fs from 'fs';

import {ConfigDownloadItem, DownloadItemState} from 'types/config';

import {DownloadItem, Event, WebContents, FileFilter, ipcMain} from 'electron';
import log from 'electron-log';

import {UPDATE_DOWNLOADS_DROPDOWN} from 'common/communication';
import Config from 'common/config';
import {localizeMessage} from 'main/i18nManager';
import {displayDownloadCompleted} from 'main/notifications';
import WindowManager from 'main/windows/windowManager';
import {isStringWithLength} from 'main/utils';

export enum DownloadItemStatusEnum {
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    INTERRUPTED = 'interrupted',
}
export enum DownloadItemTypeEnum {
    FILE = 'file',
    UPDATE = 'update',
}

class DownloadsManager {
    newDownloadController = (event: Event, item: DownloadItem, webContents: WebContents) => {
        log.debug('DownloadsManager.newDownloadController', {item, sourceURL: webContents.getURL()});
        const filename = item.getFilename();
        const fileElements = filename.split('.');
        const filters = this.getFileFilters(fileElements);
        this.shouldShowSaveDialog(item, filename, filters, Config.downloadLocation);
        this.handleDownloadItemEvents(item, webContents);
    };

    handleDownloadItemEvents = (item: DownloadItem, webContents: WebContents) => {
        item.on('done', (doneEvent, state) => {
            this.doneEventController(doneEvent, state, item, webContents);
        });
    }

    getFileFilters = (fileElements: string[]) => {
        const filters = [];
        if (fileElements.length > 1) {
            filters.push({
                name: localizeMessage('main.app.initialize.downloadBox.allFiles', 'All files'),
                extensions: ['*'],
            });
        }
        return filters;
    }

    /**
     *  This function displayes the save dialog if one of the following is true:
     *      - downloadLocation is undefined
     *      - filename is not a valid string (length > 0)
     *      - File already exists
     *
     *  Otherwise, it saves the file in the "Config.downloadLocation"
     */
    shouldShowSaveDialog = (item: DownloadItem, filename: string, filters: FileFilter[], downloadLocation?: string) => {
        log.debug('DownloadsManager.shouldShowSaveDialog', {downloadLocation, res: isStringWithLength(downloadLocation)});

        if (downloadLocation && isStringWithLength(downloadLocation)) {
            const savePath = this.getSavePathName(downloadLocation, filename);
            const fileAlreadyExists = fs.existsSync(savePath);
            if (savePath && !fileAlreadyExists) {
                item.setSavePath(savePath);
                return;
            }
        }

        item.setSaveDialogOptions({
            title: filename,
            defaultPath: undefined,
            filters,
        });
    };

    getSavePathName = (downloadLocation: string, filename?: string) => {
        const name = isStringWithLength(filename) ? filename : 'file';
        return `${downloadLocation}/${name}`;
    };

    addItemToDownloads = (item: DownloadItem) => {
        const formattedItem: ConfigDownloadItem = {
            type: DownloadItemTypeEnum.FILE,
            filename: item.getFilename(),
            status: DownloadItemStatusEnum.COMPLETED,
            progress: 100,
            location: item.getSavePath(),
            iconUrl: item.getMimeType(),
            addedAt: item.getStartTime(),
        };
        const updatedDownloads = [...Config.downloads];
        updatedDownloads.push(formattedItem);
        Config.set('downloads', updatedDownloads);
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, {downloads: Config.downloads});
    };

    /**
     *  DownloadItem event handlers
     */
    doneEventController = (doneEvent: Event, state: DownloadItemState, item: DownloadItem, webContents: WebContents) => {
        log.debug('DownloadsManager.doneEventController', {state});

        if (state === 'completed') {
            displayDownloadCompleted(path.basename(item.savePath), item.savePath, WindowManager.getServerNameByWebContentsId(webContents.id) || '');
        }

        this.addItemToDownloads(item);
    }
}

const downloadsManager = new DownloadsManager();
export default downloadsManager;
