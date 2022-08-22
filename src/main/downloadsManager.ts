// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';
import fs from 'fs';

import {ConfigDownloadItem, DownloadItemDoneEventState, DownloadItems, DownloadItemState, DownloadItemUpdatedEventState} from 'types/config';

import {DownloadItem, Event, WebContents, FileFilter, ipcMain} from 'electron';
import log from 'electron-log';

import {CLOSE_DOWNLOADS_DROPDOWN, OPEN_DOWNLOADS_DROPDOWN, UPDATE_DOWNLOADS_DROPDOWN} from 'common/communication';
import Config from 'common/config';
import {localizeMessage} from 'main/i18nManager';
import {displayDownloadCompleted} from 'main/notifications';
import WindowManager from 'main/windows/windowManager';
import {getPercentage, isStringWithLength} from 'main/utils';

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
        this.upsertFileToDownloads(item, 'progressing');
        this.handleDownloadItemEvents(item, webContents);
        this.openDownloadsDropdown();
    };

    handleDownloadItemEvents = (item: DownloadItem, webContents: WebContents) => {
        item.on('updated', (updateEvent, state) => {
            this.updatedEventController(updateEvent, state, item, webContents);
        });
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
     *  This function displays the save dialog if one of the following is true:
     *      - downloadLocation is undefined
     *      - filename is not a valid string
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

    clearDownloadsDropDown = () => {
        log.debug('DownloadsManager.clearDownloadsDropDown');
        Config.set('downloads', {});
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, {downloads: Config.downloads});
        this.closeDownloadsDropdown();
    }

    openDownloadsDropdown = () => {
        log.debug('DownloadsManager.openDownloadsDropdown');
        ipcMain.emit(OPEN_DOWNLOADS_DROPDOWN);
    }
    closeDownloadsDropdown = () => {
        log.debug('DownloadsManager.closeDownloadsDropdown');
        ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN);
    }

    formatDownloadItem = (item: DownloadItem, state: DownloadItemState): ConfigDownloadItem => {
        const totalBytes = item.getTotalBytes();
        const receivedBytes = item.getReceivedBytes();
        const progress = getPercentage(receivedBytes, totalBytes);
        return {
            addedAt: item.getStartTime(),
            filename: item.getFilename(),
            iconUrl: item.getMimeType(),
            location: item.getSavePath(),
            progress,
            receivedBytes,
            state,
            totalBytes,
            type: DownloadItemTypeEnum.FILE,
        };
    }

    upsertFileToDownloads = (item: DownloadItem, state: DownloadItemState) => {
        const fileId = item.getFilename();
        const downloadsCopy = Config.downloads;
        log.debug('DownloadsManager.upsertFileToDownloads', {fileId, downloadsCopy});
        const formattedItem = this.formatDownloadItem(item, state);
        downloadsCopy[fileId] = formattedItem;
        this.saveUpdatedDownloads(downloadsCopy);
    };

    saveUpdatedDownloads = (updatedDownloads: DownloadItems) => {
        Config.set('downloads', updatedDownloads);
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, {downloads: Config.downloads});
    }

    checkForDeletedFilesAndUpdateTheirState = (downloads: DownloadItems) => {
        const downloadsCopy = {...downloads};
        let modified = false;
        for (const fileId in downloads) {
            if (Object.prototype.hasOwnProperty.call(downloads, fileId)) {
                const file = downloads[fileId];
                if ((file.state === 'completed')) {
                    if (!file.location || !fs.existsSync(file.location)) {
                        downloadsCopy[fileId].state = 'deleted';
                        modified = true;
                    }
                } else if (file.state === 'progressing') {
                    downloadsCopy[fileId].state = 'interrupted';
                    modified = true;
                }
            }
        }
        if (modified) {
            this.saveUpdatedDownloads(downloadsCopy);
        }
        return downloadsCopy;
    }

    /**
     *  DownloadItem event handlers
     */
    updatedEventController = (updatedEvent: Event, state: DownloadItemUpdatedEventState, item: DownloadItem, webContents: WebContents) => {
        log.debug('DownloadsManager.updatedEventController', {state, updatedEvent, item, webContents});

        this.upsertFileToDownloads(item, state);
    }
    doneEventController = (doneEvent: Event, state: DownloadItemDoneEventState, item: DownloadItem, webContents: WebContents) => {
        log.debug('DownloadsManager.doneEventController', {state});

        if (state === 'completed') {
            displayDownloadCompleted(path.basename(item.savePath), item.savePath, WindowManager.getServerNameByWebContentsId(webContents.id) || '');
        }

        this.upsertFileToDownloads(item, state);
    }
}

const downloadsManager = new DownloadsManager();
export default downloadsManager;
