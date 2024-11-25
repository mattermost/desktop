// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import path from 'path';

import type {DownloadItem, Event, WebContents, FileFilter, IpcMainInvokeEvent} from 'electron';
import {ipcMain, dialog, shell, Menu, app, nativeImage} from 'electron';
import type {ProgressInfo, UpdateInfo} from 'electron-updater';

import {
    CANCEL_UPDATE_DOWNLOAD,
    CLOSE_DOWNLOADS_DROPDOWN,
    CLOSE_DOWNLOADS_DROPDOWN_MENU,
    DOWNLOADS_DROPDOWN_FOCUSED,
    GET_DOWNLOAD_LOCATION,
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
import {APP_UPDATE_KEY, UPDATE_DOWNLOAD_ITEM} from 'common/constants';
import JsonFileManager from 'common/JsonFileManager';
import {Logger} from 'common/log';
import {DOWNLOADS_DROPDOWN_AUTOCLOSE_TIMEOUT, DOWNLOADS_DROPDOWN_MAX_ITEMS} from 'common/utils/constants';
import * as Validator from 'common/Validator';
import {localizeMessage} from 'main/i18nManager';
import NotificationManager from 'main/notifications';
import {doubleSecToMs, getPercentage, isStringWithLength, readFilenameFromContentDispositionHeader, shouldIncrementFilename} from 'main/utils';
import ViewManager from 'main/views/viewManager';
import MainWindow from 'main/windows/mainWindow';

import {type DownloadedItem, type DownloadItemDoneEventState, type DownloadedItems, type DownloadItemState, type DownloadItemUpdatedEventState, DownloadItemTypeEnum} from 'types/downloads';

import appVersionManager from './AppVersionManager';
import {downloadsJson} from './constants';

const log = new Logger('DownloadsManager');

export class DownloadsManager extends JsonFileManager<DownloadedItems> {
    autoCloseTimeout: NodeJS.Timeout | null;
    open: boolean;
    fileSizes: Map<string, string>;
    progressingItems: Map<string, DownloadItem>;
    downloads: DownloadedItems;
    willDownloadURLs: Map<string, {filePath: string; bookmark?: string}>;
    bookmarks: Map<string, {originalPath: string; bookmark: string}>;

    constructor(file: string) {
        super(file);

        this.open = false;
        this.fileSizes = new Map();
        this.progressingItems = new Map();
        this.willDownloadURLs = new Map();
        this.bookmarks = new Map();
        this.autoCloseTimeout = null;
        this.downloads = {};

        this.init();
    }

    private init = () => {
        // ensure data loaded from file is valid
        const validatedJSON = Validator.validateDownloads(this.json);
        log.debug('init', {'this.json': this.json, validatedJSON});
        if (validatedJSON) {
            this.saveAll(validatedJSON);
        } else {
            this.saveAll({});
        }
        this.checkForDeletedFiles();
        this.reloadFilesForMAS();

        this.loadIPCHandlers();
    };

    private loadIPCHandlers = () => {
        ipcMain.removeHandler(REQUEST_HAS_DOWNLOADS);
        ipcMain.handle(REQUEST_HAS_DOWNLOADS, () => {
            return this.hasDownloads();
        });

        ipcMain.removeHandler(GET_DOWNLOAD_LOCATION);
        ipcMain.removeListener(DOWNLOADS_DROPDOWN_FOCUSED, this.clearAutoCloseTimeout);
        ipcMain.removeListener(UPDATE_AVAILABLE, this.onUpdateAvailable);
        ipcMain.removeListener(UPDATE_DOWNLOADED, this.onUpdateDownloaded);
        ipcMain.removeListener(UPDATE_PROGRESS, this.onUpdateProgress);
        ipcMain.removeListener(NO_UPDATE_AVAILABLE, this.noUpdateAvailable);

        ipcMain.handle(GET_DOWNLOAD_LOCATION, this.handleSelectDownload);
        ipcMain.on(DOWNLOADS_DROPDOWN_FOCUSED, this.clearAutoCloseTimeout);
        ipcMain.on(UPDATE_AVAILABLE, this.onUpdateAvailable);
        ipcMain.on(UPDATE_DOWNLOADED, this.onUpdateDownloaded);
        ipcMain.on(UPDATE_PROGRESS, this.onUpdateProgress);
        ipcMain.on(NO_UPDATE_AVAILABLE, this.noUpdateAvailable);
    };

    handleNewDownload = async (event: Event, item: DownloadItem, webContents: WebContents) => {
        log.debug('handleNewDownload', {item, sourceURL: webContents.getURL()});

        const url = item.getURL();

        if (this.willDownloadURLs.has(url)) {
            const info = this.willDownloadURLs.get(url)!;
            this.willDownloadURLs.delete(url);

            if (info.bookmark) {
                item.setSavePath(path.resolve(app.getPath('temp'), path.basename(info.filePath)));
                this.bookmarks.set(this.getFileId(item), {originalPath: info.filePath, bookmark: info.bookmark!});
            } else {
                item.setSavePath(info.filePath);
            }

            await this.upsertFileToDownloads(item, 'progressing');
            this.progressingItems.set(this.getFileId(item), item);
            this.handleDownloadItemEvents(item, webContents);
            this.openDownloadsDropdown();
            this.toggleAppMenuDownloadsEnabled(true);
        } else {
            event.preventDefault();

            if (this.shouldShowSaveDialog(item, Config.downloadLocation)) {
                const saveDialogResult = await this.showSaveDialog(item);
                if (saveDialogResult.canceled || !saveDialogResult.filePath) {
                    return;
                }
                this.willDownloadURLs.set(url, {filePath: saveDialogResult.filePath, bookmark: saveDialogResult.bookmark});
            } else {
                const filename = this.createFilename(item);
                const downloadLocation = await this.verifyMacAppStoreDownloadFolder(filename);
                const savePath = this.getSavePath(`${downloadLocation}`, filename);
                this.willDownloadURLs.set(url, {filePath: savePath});
            }

            webContents.downloadURL(url);
        }
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

    reloadFilesForMAS = () => {
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (!__IS_MAC_APP_STORE__) {
            return;
        }

        for (const file of Object.values(this.downloads)) {
            try {
                if (file.bookmark) {
                    this.bookmarks.set(this.getDownloadedFileId(file), {originalPath: file.location, bookmark: file.bookmark});

                    if (file.mimeType?.toLowerCase().startsWith('image/')) {
                        const func = app.startAccessingSecurityScopedResource(file.bookmark);
                        fs.copyFileSync(file.location, path.resolve(app.getPath('temp'), path.basename(file.location)));
                        func();
                    }
                }
            } catch (e) {
                log.warn('could not load bookmark', file.filename, e);
                this.clearFile(file);
            }
        }
    };

    checkForDeletedFiles = () => {
        log.debug('checkForDeletedFiles');
        const downloads = this.downloads;
        let modified = false;

        for (const fileId in downloads) {
            if (Object.prototype.hasOwnProperty.call(downloads, fileId)) {
                const file = downloads[fileId];

                if (this.isInvalidFile(file)) {
                    delete downloads[fileId];
                    modified = true;
                    continue;
                }

                // Remove update if app was updated and restarted OR if we disabled auto updates
                if (fileId === APP_UPDATE_KEY) {
                    if (appVersionManager.lastAppVersion === file.filename || !Config.canUpgrade) {
                        delete downloads[APP_UPDATE_KEY];
                        modified = true;
                        continue;
                    } else {
                        continue;
                    }
                }

                if (file.state === 'completed') {
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
    };

    clearDownloadsDropDown = () => {
        log.debug('clearDownloadsDropDown');

        if (this.hasUpdate()) {
            this.saveAll({
                [APP_UPDATE_KEY]: this.downloads[APP_UPDATE_KEY],
            });
        } else {
            this.saveAll({});
            this.toggleAppMenuDownloadsEnabled(false);
        }
        this.closeDownloadsDropdown();
        this.fileSizes = new Map();
    };

    showFileInFolder = (item?: DownloadedItem) => {
        log.debug('showFileInFolder', {item});

        if (!item) {
            log.debug('showFileInFolder', 'ITEM_UNDEFINED');
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

        log.debug('showFileInFolder', 'NO_DOWNLOAD_LOCATION');
    };

    openFile = (item?: DownloadedItem) => {
        log.debug('openFile', {item});

        if (!item) {
            log.debug('openFile', 'FILE_UNDEFINED');
            return;
        }

        if (item.type === DownloadItemTypeEnum.UPDATE) {
            return;
        }

        if (fs.existsSync(item.location)) {
            let func;
            const bookmark = this.bookmarks.get(this.getDownloadedFileId(item));
            if (bookmark) {
                func = app.startAccessingSecurityScopedResource(bookmark.bookmark);
            }
            shell.openPath(item.location).catch((err) => {
                log.debug('openFileError', {err});
                this.showFileInFolder(item);
            });
            func?.();
        } else {
            log.debug('openFile', 'COULD_NOT_OPEN_FILE');
            this.markFileAsDeleted(item);
            this.showFileInFolder(item);
        }
    };

    clearFile = (item?: DownloadedItem) => {
        log.debug('clearFile', {item});

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
    };

    cancelDownload = (item?: DownloadedItem) => {
        log.debug('cancelDownload', {item});

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
    };

    onOpen = () => {
        this.open = true;
        MainWindow.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
    };

    onClose = () => {
        this.open = false;
        ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN_MENU);
        this.clearAutoCloseTimeout();
    };

    getIsOpen = () => {
        return this.open;
    };

    hasDownloads = () => {
        log.debug('hasDownloads');
        return (Object.keys(this.downloads)?.length || 0) > 0;
    };

    getDownloads = () => {
        return this.downloads;
    };

    openDownloadsDropdown = () => {
        log.debug('openDownloadsDropdown');
        this.open = true;
        ipcMain.emit(OPEN_DOWNLOADS_DROPDOWN);
        MainWindow.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
    };

    hasUpdate = () => {
        return Boolean(this.downloads[APP_UPDATE_KEY]?.type === DownloadItemTypeEnum.UPDATE);
    };

    removeUpdateBeforeRestart = (): void => {
        const downloads = this.downloads;
        delete downloads[APP_UPDATE_KEY];
        this.saveAll(downloads);
    };

    private handleSelectDownload = (event: IpcMainInvokeEvent, startFrom: string) => {
        return this.selectDefaultDownloadDirectory(
            startFrom,
            localizeMessage('main.downloadsManager.specifyDownloadsFolder', 'Specify the folder where files will download'),
        );
    };

    private selectDefaultDownloadDirectory = async (startFrom: string, message: string) => {
        log.debug('handleSelectDownload', startFrom);

        const result = await dialog.showOpenDialog({defaultPath: startFrom || Config.downloadLocation,
            message,
            properties:
        ['openDirectory', 'createDirectory', 'dontAddToRecent', 'promptToCreate']});
        return result.filePaths[0];
    };

    private verifyMacAppStoreDownloadFolder = async (fileName: string) => {
        let downloadLocation = Config.downloadLocation;

        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (__IS_MAC_APP_STORE__ && downloadLocation) {
            try {
                const savePath = this.getSavePath(downloadLocation, fileName);
                fs.writeFileSync(savePath, '');
                fs.unlinkSync(savePath);
            } catch (e) {
                downloadLocation = await this.selectDefaultDownloadDirectory(
                    downloadLocation,
                    localizeMessage('main.downloadsManager.resetDownloadsFolder', 'Please reset the folder where files will download'),
                );
                Config.set('downloadLocation', downloadLocation);
            }
        }

        return downloadLocation;
    };

    private markFileAsDeleted = (item: DownloadedItem) => {
        const fileId = this.getDownloadedFileId(item);
        const file = this.downloads[fileId];
        file.state = 'deleted';
        this.save(fileId, file);
    };

    private toggleAppMenuDownloadsEnabled = (value: boolean) => {
        const appMenuDownloads = Menu.getApplicationMenu()?.getMenuItemById('app-menu-downloads');
        if (appMenuDownloads) {
            appMenuDownloads.enabled = value;
        }
    };

    private saveAll = (downloads: DownloadedItems): void => {
        log.debug('saveAll');

        this.downloads = downloads;
        this.setJson(downloads);
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, true, this.downloads);
        MainWindow.sendToRenderer(UPDATE_DOWNLOADS_DROPDOWN, this.downloads);
    };

    private save = (key: string, item: DownloadedItem) => {
        log.debug('save');
        this.downloads[key] = item;
        this.setValue(key, item);
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN, true, this.downloads);
        MainWindow.sendToRenderer(UPDATE_DOWNLOADS_DROPDOWN, this.downloads);
    };

    private handleDownloadItemEvents = (item: DownloadItem, webContents: WebContents) => {
        item.on('updated', (updateEvent, state) => {
            this.updatedEventController(updateEvent, state, item);
        });
        item.once('done', (doneEvent, state) => {
            this.doneEventController(doneEvent, state, item, webContents);
        });
    };

    /**
     *  This function return true if "downloadLocation" is undefined
     */
    private shouldShowSaveDialog = (item: DownloadItem, downloadLocation?: string) => {
        log.debug('shouldShowSaveDialog', {downloadLocation});
        return !item.hasUserGesture() || !downloadLocation;
    };

    private showSaveDialog = (item: DownloadItem) => {
        const filename = item.getFilename();
        const fileElements = filename.split('.');
        const filters = this.getFileFilters(fileElements.slice(fileElements.length - 1));

        return dialog.showSaveDialog({
            title: filename,
            defaultPath: Config.downloadLocation ? path.join(Config.downloadLocation, filename) : filename,
            filters,
            securityScopedBookmarks: true,
        });
    };

    private closeDownloadsDropdown = () => {
        log.debug('closeDownloadsDropdown');
        this.open = false;
        ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN);
        ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN_MENU);
        this.clearAutoCloseTimeout();
    };

    private clearAutoCloseTimeout = () => {
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
            this.autoCloseTimeout = null;
        }
    };

    private upsertFileToDownloads = async (item: DownloadItem, state: DownloadItemState, overridePath?: string) => {
        const fileId = this.getFileId(item);
        log.debug('upsertFileToDownloads', {fileId});
        const formattedItem = await this.formatDownloadItem(item, state, overridePath);
        this.save(fileId, formattedItem);
        this.checkIfMaxFilesReached();
    };

    private checkIfMaxFilesReached = () => {
        const downloads = this.downloads;
        if (Object.keys(downloads).length > DOWNLOADS_DROPDOWN_MAX_ITEMS) {
            const oldestFileId = Object.keys(downloads).reduce((prev, curr) => {
                return downloads[prev]?.addedAt > downloads[curr]?.addedAt ? curr : prev;
            });
            delete downloads[oldestFileId];
            this.saveAll(downloads);
        }
    };

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
    };

    private shouldShowBadge = () => {
        log.debug('shouldShowBadge');

        if (this.open === true) {
            MainWindow.sendToRenderer(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
        } else {
            MainWindow.sendToRenderer(SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE);
        }
    };

    /**
     *  DownloadItem event handlers
     */
    private updatedEventController = async (updatedEvent: Event, state: DownloadItemUpdatedEventState, item: DownloadItem) => {
        log.debug('updatedEventController', {state});

        await this.upsertFileToDownloads(item, state);

        if (state === 'interrupted') {
            this.fileSizes.delete(item.getFilename());
            this.progressingItems.delete(this.getFileId(item));
        }
        this.shouldShowBadge();
    };

    private doneEventController = async (doneEvent: Event, state: DownloadItemDoneEventState, item: DownloadItem, webContents: WebContents) => {
        log.debug('doneEventController', {state});

        if (state === 'completed' && !this.open) {
            NotificationManager.displayDownloadCompleted(path.basename(item.savePath), item.savePath, ViewManager.getViewByWebContentsId(webContents.id)?.view.server.name ?? '');
        }

        const bookmark = this.bookmarks.get(this.getFileId(item));
        if (bookmark) {
            const func = app.startAccessingSecurityScopedResource(bookmark?.bookmark);
            fs.copyFileSync(path.resolve(app.getPath('temp'), path.basename(bookmark.originalPath)), bookmark.originalPath);
            func();
        }

        await this.upsertFileToDownloads(item, state, bookmark?.originalPath);
        this.fileSizes.delete(item.getFilename());
        this.progressingItems.delete(this.getFileId(item));
        this.shouldAutoClose();
        this.shouldShowBadge();
    };

    /**
     * Related to application updates
     */
    private onUpdateAvailable = (event: Event, version = 'unknown') => {
        this.save(APP_UPDATE_KEY, {
            ...UPDATE_DOWNLOAD_ITEM,
            filename: version,
            state: 'available',
        });
        this.openDownloadsDropdown();
    };
    private onUpdateDownloaded = (event: Event, info: UpdateInfo) => {
        log.debug('onUpdateDownloaded', {info});

        const {version} = info;
        const update = this.downloads[APP_UPDATE_KEY];
        update.state = 'completed';
        update.progress = 100;
        update.filename = version;

        this.save(APP_UPDATE_KEY, update);
        this.openDownloadsDropdown();
    };
    private onUpdateProgress = (event: Event, progress: ProgressInfo) => {
        log.debug('onUpdateProgress', {progress});
        const {total, transferred, percent} = progress;
        const update = this.downloads[APP_UPDATE_KEY] || {...UPDATE_DOWNLOAD_ITEM};
        if (typeof update.addedAt !== 'number' || update.addedAt === 0) {
            update.addedAt = Date.now();
        }
        update.state = 'progressing';
        update.totalBytes = total;
        update.receivedBytes = transferred;
        update.progress = Math.round(percent);
        this.save(APP_UPDATE_KEY, update);
        this.shouldShowBadge();
    };
    private noUpdateAvailable = () => {
        const downloads = this.downloads;
        delete downloads[APP_UPDATE_KEY];
        this.saveAll(downloads);

        if (!this.hasDownloads()) {
            this.closeDownloadsDropdown();
        }
    };

    /**
     * Internal utils
     */
    private formatDownloadItem = async (item: DownloadItem, state: DownloadItemState, overridePath?: string): Promise<DownloadedItem> => {
        const totalBytes = this.getFileSize(item);
        const receivedBytes = item.getReceivedBytes();
        const progress = getPercentage(receivedBytes, totalBytes);

        let thumbnailData;
        if (state === 'completed' && item.getMimeType().toLowerCase().startsWith('image/')) {
            const fallback = async () => {
                // We also will cap this at 1MB so as to not inflate the memory usage of the downloads dropdown
                if (item.getReceivedBytes() < 1000000) {
                    thumbnailData = (await nativeImage.createFromPath(overridePath ?? item.getSavePath())).toDataURL();
                }
            };

            // Linux doesn't support the thumbnail creation so we have to use the base function
            if (process.platform === 'linux') {
                await fallback();
            } else {
                // This has been known to fail on Windows, see: https://github.com/mattermost/desktop/issues/3140
                try {
                    thumbnailData = (await nativeImage.createThumbnailFromPath(overridePath ?? item.getSavePath(), {height: 32, width: 32})).toDataURL();
                } catch {
                    await fallback();
                }
            }
        }

        return {
            addedAt: doubleSecToMs(item.getStartTime()),
            filename: this.getFileId(item),
            mimeType: item.getMimeType(),
            location: overridePath ?? item.getSavePath(),
            progress,
            receivedBytes,
            state,
            totalBytes,
            type: DownloadItemTypeEnum.FILE,
            bookmark: this.getBookmark(item),
            thumbnailData,
        };
    };

    private getBookmark = (item: DownloadItem) => {
        return this.bookmarks.get(this.getFileId(item))?.bookmark;
    };

    private getFileSize = (item: DownloadItem) => {
        const itemTotalBytes = item.getTotalBytes();
        if (!itemTotalBytes) {
            return parseInt(this.fileSizes.get(item.getFilename()) || '0', 10);
        }
        return itemTotalBytes;
    };

    private getSavePath = (downloadLocation: string, filename?: string) => {
        const name = isStringWithLength(filename) ? `${filename}` : 'file';
        return path.join(downloadLocation, name);
    };

    private getFileFilters = (fileElements: string[]): FileFilter[] => {
        const filters = fileElements.map((element) => ({
            name: `${element.toUpperCase()} (*.${element})`,
            extensions: [element],
        }));

        filters.push({
            name: localizeMessage('main.app.initialize.downloadBox.allFiles', 'All files'),
            extensions: ['*'],
        });

        return filters;
    };

    private createFilename = (item: DownloadItem): string => {
        const defaultFilename = item.getFilename();
        const incrementedFilenameIfExists = shouldIncrementFilename(path.join(`${Config.downloadLocation}`, defaultFilename));
        return incrementedFilenameIfExists;
    };

    private readFilenameFromPath = (savePath: string) => {
        const pathObj = path.parse(savePath);
        return pathObj.base;
    };

    private getFileId = (item: DownloadItem) => {
        const fileNameFromPath = this.readFilenameFromPath(item.savePath);
        const itemFilename = item.getFilename();
        return fileNameFromPath && fileNameFromPath !== itemFilename ? fileNameFromPath : itemFilename;
    };

    private getDownloadedFileId = (item: DownloadedItem) => {
        if (item.type === DownloadItemTypeEnum.UPDATE) {
            return APP_UPDATE_KEY;
        }
        const fileNameFromPath = this.readFilenameFromPath(item.location);
        const itemFilename = item.filename;
        return fileNameFromPath && fileNameFromPath !== itemFilename ? fileNameFromPath : itemFilename;
    };

    private isAppUpdate = (item: DownloadedItem): boolean => {
        return item.type === DownloadItemTypeEnum.UPDATE;
    };

    private isInvalidFile(file: DownloadedItem) {
        return (typeof file !== 'object') ||
            !file.filename ||
            !file.state ||
            !file.type;
    }
}

let downloadsManager = new DownloadsManager(downloadsJson);

ipcMain.on(UPDATE_PATHS, () => {
    downloadsManager = new DownloadsManager(downloadsJson);
});

export default downloadsManager;
