// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';
import fs from 'fs';

import {ConfigDownloadItem, DownloadItemDoneEventState, DownloadItems, DownloadItemState, DownloadItemUpdatedEventState} from 'types/config';

import {DownloadItem, Event, WebContents, FileFilter, ipcMain, dialog, shell} from 'electron';
import log from 'electron-log';

import {CLOSE_DOWNLOADS_DROPDOWN, HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE, OPEN_DOWNLOADS_DROPDOWN, SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE, UPDATE_DOWNLOADS_DROPDOWN} from 'common/communication';
import Config from 'common/config';
import {localizeMessage} from 'main/i18nManager';
import {displayDownloadCompleted} from 'main/notifications';
import WindowManager from 'main/windows/windowManager';
import {getPercentage, isStringWithLength, readFilenameFromContentDispositionHeader} from 'main/utils';
import {DOWNLOADS_DROPDOWN_AUTOCLOSE_TIMEOUT, DOWNLOADS_DROPDOWN_MAX_ITEMS} from 'common/utils/constants';

export enum DownloadItemTypeEnum {
    FILE = 'file',
    UPDATE = 'update',
}

class DownloadsManager {
    private isOpen = false;
    private fileSizes = new Map<string, string>();
    private autoCloseTimeout: NodeJS.Timeout | null = null;

    handleNewDownload = (event: Event, item: DownloadItem, webContents: WebContents) => {
        log.debug('DownloadsManager.handleNewDownload', {item, sourceURL: webContents.getURL()});

        const filename = item.getFilename();
        const shouldShowSaveDialog = this.shouldShowSaveDialog(filename, Config.downloadLocation);
        if (shouldShowSaveDialog) {
            const saveDialogSuccess = this.showSaveDialog(item);
            if (!saveDialogSuccess) {
                item.cancel();
                return;
            }
        } else {
            const savePath = this.getSavePath(Config.downloadLocation, filename);
            item.setSavePath(savePath);
        }
        this.upsertFileToDownloads(item, 'progressing');
        this.handleDownloadItemEvents(item, webContents);
        this.openDownloadsDropdown();
    };

    /**
     * This function monitors webRequests and retrieves the total file size (of files being downloaded)
     * from the custom HTTP header "x-uncompressed-content-length".
     */
    webRequestOnHeadersReceivedHandler = (details: Electron.OnHeadersReceivedListenerDetails, cb: (headersReceivedResponse: Electron.HeadersReceivedResponse) => void) => {
        const headers = details.responseHeaders ?? {};

        if (headers?.['content-encoding']?.includes('gzip') && headers?.['x-uncompressed-content-length'] && headers?.['content-disposition'].join(';')?.includes('filename=')) {
            const filename = readFilenameFromContentDispositionHeader(headers['content-disposition']);
            const fileSize = headers['x-uncompressed-content-length']?.[0] || '0';
            if (filename && (!this.fileSizes.has(filename) || this.fileSizes.get(filename)?.toString() !== fileSize)) {
                this.fileSizes.set(filename, fileSize);
            }
        }

        // With no arguments it uses the same headers
        cb({});
    };

    checkForDeletedFilesAndUpdateTheirState = (downloads: DownloadItems) => {
        log.debug('DownloadsManager.handleNewDownload');

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

    clearDownloadsDropDown = () => {
        log.debug('DownloadsManager.clearDownloadsDropDown');

        Config.set('downloads', {});
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, {downloads: Config.downloads});
        this.closeDownloadsDropdown();
    }

    openFile = (item?: ConfigDownloadItem) => {
        if (item && fs.existsSync(item.location)) {
            shell.showItemInFolder(item.location);
            return;
        }

        if (Config.downloadLocation) {
            shell.openPath(Config.downloadLocation);
            return;
        }

        log.debug('DownloadsDropdownView.openFile', 'NO_DOWNLOAD_LOCATION');
    }

    setIsOpen = (val: boolean) => {
        this.isOpen = val;
        if (val === true) {
            WindowManager.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
        }
    }

    getIsOpen = () => {
        return this.isOpen;
    }

    getHasDownloads = () => {
        return (Object.keys(Config.downloads)?.length || 0) > 0;
    }

    openDownloadsDropdown = () => {
        log.debug('DownloadsManager.openDownloadsDropdown');

        this.isOpen = true;
        ipcMain.emit(OPEN_DOWNLOADS_DROPDOWN);
        WindowManager.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
    }

    private handleDownloadItemEvents = (item: DownloadItem, webContents: WebContents) => {
        item.on('updated', (updateEvent, state) => {
            this.updatedEventController(updateEvent, state, item);
        });
        item.on('done', (doneEvent, state) => {
            this.doneEventController(doneEvent, state, item, webContents);
        });
    }

    /**
     *  This function return true if one of the following is true:
     *      - downloadLocation is undefined
     *      - filename is not a valid string
     *      - File already exists
     */
    private shouldShowSaveDialog = (filename: string, downloadLocation?: string) => {
        log.debug('DownloadsManager.shouldShowSaveDialog', {downloadLocation, res: isStringWithLength(downloadLocation)});

        if (downloadLocation && isStringWithLength(downloadLocation)) {
            const savePath = this.getSavePath(downloadLocation, filename);
            const fileAlreadyExists = fs.existsSync(savePath);
            if (savePath && !fileAlreadyExists) {
                return false;
            }
        }
        return true;
    };

    private showSaveDialog = (item: DownloadItem) => {
        const filename = item.getFilename();
        const fileElements = filename.split('.');
        const filters = this.getFileFilters(fileElements);

        const newPath = dialog.showSaveDialogSync({
            title: filename,
            defaultPath: filename,
            filters,
        });

        if (newPath) {
            item.setSavePath(newPath);
            return true;
        }
        return false;
    }

    private closeDownloadsDropdown = () => {
        log.debug('DownloadsManager.closeDownloadsDropdown');

        this.isOpen = false;
        ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN);

        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
            this.autoCloseTimeout = null;
        }
    }

    private upsertFileToDownloads = (item: DownloadItem, state: DownloadItemState) => {
        const fileId = this.getFileId(item);
        const downloadsCopy = Config.downloads;
        log.debug('DownloadsManager.upsertFileToDownloads', {fileId, downloadsCopy});
        const formattedItem = this.formatDownloadItem(item, state);
        downloadsCopy[fileId] = formattedItem;
        const downloadsToSave = this.checkIfMaxFilesReached(downloadsCopy);
        this.saveUpdatedDownloads(downloadsToSave);
    };

    private saveUpdatedDownloads = (updatedDownloads: DownloadItems) => {
        Config.set('downloads', updatedDownloads);
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, {downloads: Config.downloads});
    }

    private checkIfMaxFilesReached = (downloads: DownloadItems) => {
        if (Object.keys(downloads).length > DOWNLOADS_DROPDOWN_MAX_ITEMS) {
            const oldestFileId = Object.keys(downloads).reduce((prev, curr) => {
                return downloads[prev].addedAt > downloads[curr].addedAt ? curr : prev;
            });
            delete downloads[oldestFileId];
        }
        return downloads;
    }

    private shouldAutoClose = () => {
        // if no other file is being downloaded
        if (!Object.values(Config.downloads).some((item) => item.state === 'progressing')) {
            if (this.autoCloseTimeout) {
                this.autoCloseTimeout.refresh();
            } else {
                this.autoCloseTimeout = setTimeout(() => this.closeDownloadsDropdown(), DOWNLOADS_DROPDOWN_AUTOCLOSE_TIMEOUT);
            }
        }
    }

    private shouldShowBadge = () => {
        log.debug('DownloadsManager.shouldShowBadge', {isOpen: this.isOpen});

        if (this.isOpen === true) {
            WindowManager.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
        } else {
            WindowManager.sendToRenderer(SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
        }
    }

    /**
     *  DownloadItem event handlers
     */
    private updatedEventController = (updatedEvent: Event, state: DownloadItemUpdatedEventState, item: DownloadItem) => {
        log.debug('DownloadsManager.updatedEventController', {state, updatedEvent});

        this.upsertFileToDownloads(item, state);

        if (state === 'interrupted') {
            this.fileSizes.delete(item.getFilename());
        }
        this.shouldShowBadge();
    }

    private doneEventController = (doneEvent: Event, state: DownloadItemDoneEventState, item: DownloadItem, webContents: WebContents) => {
        log.debug('DownloadsManager.doneEventController', {state});

        if (state === 'completed') {
            displayDownloadCompleted(path.basename(item.savePath), item.savePath, WindowManager.getServerNameByWebContentsId(webContents.id) || '');
        }

        this.upsertFileToDownloads(item, state);

        this.fileSizes.delete(item.getFilename());
        this.shouldAutoClose();
        this.shouldShowBadge();
    }

    /**
     * Internal utils
     */
    private formatDownloadItem = (item: DownloadItem, state: DownloadItemState): ConfigDownloadItem => {
        const totalBytes = this.getFileSize(item);
        const receivedBytes = item.getReceivedBytes();
        const progress = getPercentage(receivedBytes, totalBytes);

        return {
            addedAt: item.getStartTime(),
            filename: this.getFileId(item),
            mimeType: item.getMimeType(),
            location: item.getSavePath(),
            progress,
            receivedBytes,
            state,
            totalBytes,
            type: DownloadItemTypeEnum.FILE,
        };
    }

    private getFileSize = (item: DownloadItem) => {
        const itemTotalBytes = item.getTotalBytes();
        if (!itemTotalBytes) {
            return parseInt(this.fileSizes.get(item.getFilename()) || '0', 10);
        }
        return itemTotalBytes;
    }

    private getSavePath = (downloadLocation?: string, filename?: string) => {
        const name = isStringWithLength(filename) ? filename : 'file';

        return `${downloadLocation}/${name}`;
    };

    private getFileFilters = (fileElements: string[]): FileFilter[] => {
        const filters = [];

        if (fileElements.length > 1) {
            filters.push({
                name: localizeMessage('main.app.initialize.downloadBox.allFiles', 'All files'),
                extensions: ['*'],
            });
        }

        return filters;
    }

    private readFilenameFromPath = (path: string) => {
        return path.split('/').pop();
    }

    private getFileId = (item: DownloadItem) => {
        const fileNameFromPath = this.readFilenameFromPath(item.savePath);
        const itemFilename = item.getFilename();
        return fileNameFromPath && fileNameFromPath !== itemFilename ? fileNameFromPath : itemFilename;
    }
}

const downloadsManager = new DownloadsManager();
export default downloadsManager;
