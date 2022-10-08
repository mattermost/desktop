// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';
import fs from 'fs';

import {DownloadItem, Event, WebContents, FileFilter, ipcMain, dialog, shell, Menu} from 'electron';
import log from 'electron-log';
import {ProgressInfo} from 'electron-updater';

import {DownloadedItem, DownloadItemDoneEventState, DownloadedItems, DownloadItemState, DownloadItemUpdatedEventState} from 'types/downloads';

import {
    CANCEL_UPDATE_DOWNLOAD,
    CLOSE_DOWNLOADS_DROPDOWN,
    CLOSE_DOWNLOADS_DROPDOWN_MENU,
    DOWNLOADS_DROPDOWN_FOCUSED,
    HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE,
    NO_UPDATE_AVAILABLE,
    OPEN_DOWNLOADS_DROPDOWN,
    REQUEST_HAS_DOWNLOADS,
    SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE,
    UPDATE_AVAILABLE,
    UPDATE_DOWNLOADED,
    UPDATE_DOWNLOADS_DROPDOWN,
    UPDATE_PATHS,
    UPDATE_PROGRESS,
} from 'common/communication';
import Config from 'common/config';
import {localizeMessage} from 'main/i18nManager';
import {displayDownloadCompleted} from 'main/notifications';
import WindowManager from 'main/windows/windowManager';
import {doubleSecToMs, getPercentage, isStringWithLength, readFilenameFromContentDispositionHeader, shouldIncrementFilename} from 'main/utils';
import {DOWNLOADS_DROPDOWN_AUTOCLOSE_TIMEOUT, DOWNLOADS_DROPDOWN_MAX_ITEMS} from 'common/utils/constants';
import JsonFileManager from 'common/JsonFileManager';

import {APP_UPDATE_KEY} from 'common/constants';

import {downloadsJson} from './constants';
import * as Validator from './Validator';

export enum DownloadItemTypeEnum {
    FILE = 'file',
    UPDATE = 'update',
}

export class DownloadsManager extends JsonFileManager<DownloadedItems> {
    autoCloseTimeout: NodeJS.Timeout | null;
    open: boolean;

    fileSizes: Map<string, string>;
    progressingItems: Map<string, DownloadItem>;
    downloads: DownloadedItems;

    constructor(file: string) {
        super(file);

        this.open = false;
        this.fileSizes = new Map();
        this.progressingItems = new Map();
        this.autoCloseTimeout = null;
        this.downloads = {};

        this.init();
    }

    private init = () => {
        // ensure data loaded from file is valid
        const validatedJSON = Validator.validateDownloads(this.json);
        log.debug('DownloadsManager.init', {'this.json': this.json, validatedJSON});
        if (validatedJSON) {
            this.saveAll(validatedJSON);
        } else {
            this.saveAll({});
        }
        this.checkForDeletedFiles();

        ipcMain.handle(REQUEST_HAS_DOWNLOADS, () => {
            return this.hasDownloads();
        });
        ipcMain.on(DOWNLOADS_DROPDOWN_FOCUSED, this.clearAutoCloseTimeout);
        ipcMain.on(UPDATE_AVAILABLE, this.onUpdateAvailable);
        ipcMain.on(UPDATE_DOWNLOADED, this.onUpdateDownloaded);
        ipcMain.on(UPDATE_PROGRESS, this.onUpdateProgress);
        ipcMain.on(NO_UPDATE_AVAILABLE, this.noUpdateAvailable);
    }

    handleNewDownload = (event: Event, item: DownloadItem, webContents: WebContents) => {
        log.debug('DownloadsManager.handleNewDownload', {item, sourceURL: webContents.getURL()});

        const shouldShowSaveDialog = this.shouldShowSaveDialog(Config.downloadLocation);
        if (shouldShowSaveDialog) {
            const saveDialogSuccess = this.showSaveDialog(item);
            if (!saveDialogSuccess) {
                item.cancel();
                return;
            }
        } else {
            const filename = this.createFilename(item);
            const savePath = this.getSavePath(`${Config.downloadLocation}`, filename);
            item.setSavePath(savePath);
        }
        this.upsertFileToDownloads(item, 'progressing');
        this.progressingItems.set(this.getFileId(item), item);
        this.handleDownloadItemEvents(item, webContents);
        this.openDownloadsDropdown();
        this.toggleAppMenuDownloadsEnabled(true);
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

    checkForDeletedFiles = () => {
        log.debug('DownloadsManager.checkForDeletedFiles');

        const downloads = this.downloads;
        let modified = false;

        for (const fileId in downloads) {
            if (fileId === APP_UPDATE_KEY) {
                continue;
            }
            if (Object.prototype.hasOwnProperty.call(downloads, fileId)) {
                const file = downloads[fileId];
                if ((file.state === 'completed')) {
                    if (!file.location || !fs.existsSync(file.location)) {
                        downloads[fileId].state = 'deleted';
                        modified = true;
                    }
                } else if (file.state === 'progressing') {
                    downloads[fileId].state = 'interrupted';
                    modified = true;
                }
            }
        }

        if (modified) {
            this.saveAll(downloads);
        }
    }

    clearDownloadsDropDown = () => {
        log.debug('DownloadsManager.clearDownloadsDropDown');

        this.saveAll({});
        this.fileSizes = new Map();
        this.closeDownloadsDropdown();
        this.toggleAppMenuDownloadsEnabled(false);
    }

    showFileInFolder = (item?: DownloadedItem) => {
        log.debug('DownloadsDropdownView.showFileInFolder', {item});

        if (!item) {
            log.debug('DownloadsDropdownView.showFileInFolder', 'ITEM_UNDEFINED');
            return;
        }

        if (item.type === DownloadItemTypeEnum.UPDATE) {
            return;
        }

        if (fs.existsSync(item.location)) {
            shell.showItemInFolder(item.location);
            return;
        }
        this.markFileAsDeleted(item);

        if (Config.downloadLocation) {
            shell.openPath(Config.downloadLocation);
            return;
        }

        log.debug('DownloadsDropdownView.showFileInFolder', 'NO_DOWNLOAD_LOCATION');
    }

    openFile = (item?: DownloadedItem) => {
        log.debug('DownloadsDropdownView.openFile', {item});

        if (!item) {
            log.debug('DownloadsDropdownView.openFile', 'FILE_UNDEFINED');
            return;
        }

        if (item.type === DownloadItemTypeEnum.UPDATE) {
            return;
        }

        if (fs.existsSync(item.location)) {
            shell.openPath(item.location).catch((err) => {
                log.debug('DownloadsDropdownView.openFileError', {err});
                this.showFileInFolder(item);
            });
        } else {
            log.debug('DownloadsDropdownView.openFile', 'COULD_NOT_OPEN_FILE');
            this.markFileAsDeleted(item);
            this.showFileInFolder(item);
        }
    }

    clearFile = (item?: DownloadedItem) => {
        log.debug('DownloadsDropdownView.clearFile', {item});

        if (!item || item.type === DownloadItemTypeEnum.UPDATE) {
            return;
        }

        const fileId = this.getDownloadedFileId(item);
        const downloads = this.downloads;
        delete downloads[fileId];
        this.saveAll(downloads);

        if (!this.hasDownloads()) {
            this.closeDownloadsDropdown();
        }
    }

    cancelDownload = (item?: DownloadedItem) => {
        log.debug('DownloadsDropdownView.cancelDownload', {item});

        if (!item) {
            return;
        }

        const fileId = this.getDownloadedFileId(item);

        if (this.isAppUpdate(item)) {
            ipcMain.emit(CANCEL_UPDATE_DOWNLOAD);
            const update = this.downloads[APP_UPDATE_KEY];
            update.state = 'cancelled';
            this.save(APP_UPDATE_KEY, update);
        } else if (this.progressingItems.has(fileId)) {
            this.progressingItems.get(fileId)?.cancel?.();
            this.progressingItems.delete(fileId);
        }
    }

    onOpen = () => {
        this.open = true;
        WindowManager.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
    }

    onClose = () => {
        this.open = false;
        ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN_MENU);
        this.clearAutoCloseTimeout();
    }

    getIsOpen = () => {
        return this.open;
    }

    hasDownloads = () => {
        log.debug('DownloadsManager.hasDownloads');
        return (Object.keys(this.downloads)?.length || 0) > 0;
    }

    getDownloads = () => {
        return this.downloads;
    }

    openDownloadsDropdown = () => {
        log.debug('DownloadsManager.openDownloadsDropdown');

        this.open = true;
        ipcMain.emit(OPEN_DOWNLOADS_DROPDOWN);
        WindowManager.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
    }

    private markFileAsDeleted = (item: DownloadedItem) => {
        const fileId = this.getDownloadedFileId(item);
        const file = this.downloads[fileId];
        file.state = 'deleted';
        this.save(fileId, file);
    }

    private toggleAppMenuDownloadsEnabled = (value: boolean) => {
        const appMenuDownloads = Menu.getApplicationMenu()?.getMenuItemById('app-menu-downloads');
        if (appMenuDownloads) {
            appMenuDownloads.enabled = value;
        }
    }

    private saveAll = (downloads: DownloadedItems) => {
        log.debug('DownloadsManager.saveAll');

        this.downloads = downloads;
        this.setJson(downloads);
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, true, this.downloads);
        WindowManager?.sendToRenderer(UPDATE_DOWNLOADS_DROPDOWN, this.downloads);
    }

    private save = (key: string, item: DownloadedItem) => {
        log.debug('DownloadsManager.save');

        this.downloads[key] = item;
        this.setValue(key, item);
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, true, this.downloads);
        WindowManager?.sendToRenderer(UPDATE_DOWNLOADS_DROPDOWN, this.downloads);
    }

    private handleDownloadItemEvents = (item: DownloadItem, webContents: WebContents) => {
        item.on('updated', (updateEvent, state) => {
            this.updatedEventController(updateEvent, state, item);
        });
        item.once('done', (doneEvent, state) => {
            this.doneEventController(doneEvent, state, item, webContents);
        });
    }

    /**
     *  This function return true if "downloadLocation" is undefined
     */
    private shouldShowSaveDialog = (downloadLocation?: string) => {
        log.debug('DownloadsManager.shouldShowSaveDialog', {downloadLocation});

        return !downloadLocation;
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

        this.open = false;
        ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN);
        ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN_MENU);

        this.clearAutoCloseTimeout();
    }

    private clearAutoCloseTimeout = () => {
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
            this.autoCloseTimeout = null;
        }
    }

    private upsertFileToDownloads = (item: DownloadItem, state: DownloadItemState) => {
        const fileId = this.getFileId(item);
        log.debug('DownloadsManager.upsertFileToDownloads', {fileId});

        const formattedItem = this.formatDownloadItem(item, state);
        this.save(fileId, formattedItem);
        this.checkIfMaxFilesReached();
    };

    private checkIfMaxFilesReached = () => {
        const downloads = this.downloads;
        if (Object.keys(downloads).length > DOWNLOADS_DROPDOWN_MAX_ITEMS) {
            const oldestFileId = Object.keys(downloads).reduce((prev, curr) => {
                return downloads[prev].addedAt > downloads[curr].addedAt ? curr : prev;
            });
            delete downloads[oldestFileId];
            this.saveAll(downloads);
        }
    }

    private shouldAutoClose = () => {
        // if some other file is being downloaded
        if (Object.values(this.downloads).some((item) => item.state === 'progressing')) {
            return;
        }
        if (this.autoCloseTimeout) {
            this.autoCloseTimeout.refresh();
        } else {
            this.autoCloseTimeout = setTimeout(() => this.closeDownloadsDropdown(), DOWNLOADS_DROPDOWN_AUTOCLOSE_TIMEOUT);
        }
    }

    private shouldShowBadge = () => {
        log.debug('DownloadsManager.shouldShowBadge');

        if (this.open === true) {
            WindowManager.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
        } else {
            WindowManager.sendToRenderer(SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
        }
    }

    /**
     *  DownloadItem event handlers
     */
    private updatedEventController = (updatedEvent: Event, state: DownloadItemUpdatedEventState, item: DownloadItem) => {
        log.debug('DownloadsManager.updatedEventController', {state});

        this.upsertFileToDownloads(item, state);

        if (state === 'interrupted') {
            this.fileSizes.delete(item.getFilename());
            this.progressingItems.delete(this.getFileId(item));
        }
        this.shouldShowBadge();
    }

    private doneEventController = (doneEvent: Event, state: DownloadItemDoneEventState, item: DownloadItem, webContents: WebContents) => {
        log.debug('DownloadsManager.doneEventController', {state});

        if (state === 'completed' && !this.open) {
            displayDownloadCompleted(path.basename(item.savePath), item.savePath, WindowManager.getServerNameByWebContentsId(webContents.id) || '');
        }

        this.upsertFileToDownloads(item, state);

        this.fileSizes.delete(item.getFilename());
        this.progressingItems.delete(this.getFileId(item));
        this.shouldAutoClose();
        this.shouldShowBadge();
    }

    /**
     * Related to application updates
     */
    private onUpdateAvailable = (event: Event, version = 'unknown') => {
        this.save(APP_UPDATE_KEY, {
            type: DownloadItemTypeEnum.UPDATE,
            filename: version,
            state: 'available',
            progress: 0,
            location: '',
            mimeType: null,
            addedAt: 0,
            receivedBytes: 0,
            totalBytes: 0,
        });
        this.openDownloadsDropdown();
    }
    private onUpdateDownloaded = (event: Event, version = 'unknown') => {
        const update = this.downloads[APP_UPDATE_KEY];
        update.state = 'completed';
        update.progress = 100;
        update.filename = version;
        this.save(APP_UPDATE_KEY, update);
        this.openDownloadsDropdown();
    }
    private onUpdateProgress = (event: Event, progress: ProgressInfo) => {
        log.debug('DownloadsManager.onUpdateProgress', {progress});
        const {total, transferred, percent} = progress;

        const update = this.downloads[APP_UPDATE_KEY];
        if (typeof update.addedAt !== 'number' || update.addedAt === 0) {
            update.addedAt = Date.now();
        }
        update.state = 'progressing';
        update.totalBytes = total;
        update.receivedBytes = transferred;
        update.progress = Math.round(percent);
        this.shouldShowBadge();
    }
    private noUpdateAvailable = () => {
        const downloads = this.downloads;
        delete downloads[APP_UPDATE_KEY];
        this.saveAll(downloads);

        if (!this.hasDownloads()) {
            this.closeDownloadsDropdown();
        }
    }

    /**
     * Internal utils
     */
    private formatDownloadItem = (item: DownloadItem, state: DownloadItemState): DownloadedItem => {
        const totalBytes = this.getFileSize(item);
        const receivedBytes = item.getReceivedBytes();
        const progress = getPercentage(receivedBytes, totalBytes);

        return {
            addedAt: doubleSecToMs(item.getStartTime()),
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

    private getSavePath = (downloadLocation: string, filename?: string) => {
        const name = isStringWithLength(filename) ? `${filename}` : 'file';
        return path.join(downloadLocation, name);
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

    private createFilename = (item: DownloadItem): string => {
        const defaultFilename = item.getFilename();
        const incrementedFilenameIfExists = shouldIncrementFilename(path.join(`${Config.downloadLocation}`, defaultFilename));
        return incrementedFilenameIfExists;
    }

    private readFilenameFromPath = (savePath: string) => {
        const pathObj = path.parse(savePath);
        return pathObj.base;
    }

    private getFileId = (item: DownloadItem) => {
        const fileNameFromPath = this.readFilenameFromPath(item.savePath);
        const itemFilename = item.getFilename();
        return fileNameFromPath && fileNameFromPath !== itemFilename ? fileNameFromPath : itemFilename;
    }

    private getDownloadedFileId = (item: DownloadedItem) => {
        if (item.type === DownloadItemTypeEnum.UPDATE) {
            return APP_UPDATE_KEY;
        }
        const fileNameFromPath = this.readFilenameFromPath(item.location);
        const itemFilename = item.filename;
        return fileNameFromPath && fileNameFromPath !== itemFilename ? fileNameFromPath : itemFilename;
    }

    private isAppUpdate = (item: DownloadedItem): boolean => {
        return item.type === DownloadItemTypeEnum.UPDATE;
    }
}

let downloadsManager = new DownloadsManager(downloadsJson);

ipcMain.on(UPDATE_PATHS, () => {
    downloadsManager = new DownloadsManager(downloadsJson);
});

export default downloadsManager;
