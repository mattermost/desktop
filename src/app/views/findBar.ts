// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow, IpcMainEvent, Rectangle, WebContents} from 'electron';
import {ipcMain, WebContentsView} from 'electron';
import Joi from 'joi';

import {
    FIND_BAR_CLOSE,
    FIND_BAR_FOCUS,
    FIND_BAR_OPEN,
    FIND_BAR_RESULT,
    FIND_IN_PAGE,
    FIND_IN_PAGE_NEXT,
    FIND_IN_PAGE_PREV,
} from 'common/communication';
import {Logger} from 'common/log';
import {FIND_BAR_HEIGHT, FIND_BAR_MARGIN, FIND_BAR_WIDTH} from 'common/utils/constants';
import {ipcValidate} from 'common/Validator';
import performanceMonitor from 'main/performanceMonitor';
import ThemeManager from 'main/themeManager';
import {getLocalPreload} from 'main/utils';

const log = new Logger('FindBar');

const findInPageOptionsSchema = Joi.object({
    forward: Joi.boolean(),
    findNext: Joi.boolean(),
}).optional();

type FindInPageOptions = {
    forward?: boolean;
    findNext?: boolean;
};

type FindBarResult = {
    activeMatchOrdinal: number;
    matches: number;
};

const findBarsByParent = new WeakMap<BrowserWindow, FindBar>();
const findBarsBySenderId = new Map<number, FindBar>();
let ipcRegistered = false;

function registerFindBarIpc() {
    if (ipcRegistered) {
        return;
    }
    ipcRegistered = true;

    ipcMain.on(FIND_IN_PAGE, ipcValidate(handleFindInPage, [Joi.string().allow('').required(), findInPageOptionsSchema]));
    ipcMain.on(FIND_IN_PAGE_NEXT, handleFindInPageNext);
    ipcMain.on(FIND_IN_PAGE_PREV, handleFindInPagePrev);
    ipcMain.on(FIND_BAR_CLOSE, handleFindBarClose);
}

function getFindBarForEvent(event: IpcMainEvent) {
    return findBarsBySenderId.get(event.sender.id);
}

function handleFindInPage(event: IpcMainEvent, text: string, options?: FindInPageOptions) {
    getFindBarForEvent(event)?.find(text, options);
}

function handleFindInPageNext(event: IpcMainEvent) {
    getFindBarForEvent(event)?.findNext();
}

function handleFindInPagePrev(event: IpcMainEvent) {
    getFindBarForEvent(event)?.findPrevious();
}

function handleFindBarClose(event: IpcMainEvent) {
    getFindBarForEvent(event)?.close();
}

export function getFindBar(parent: BrowserWindow) {
    let findBar = findBarsByParent.get(parent);
    if (!findBar) {
        findBar = new FindBar(parent);
        findBarsByParent.set(parent, findBar);
    }
    return findBar;
}

export function openFindBar(parent: BrowserWindow, target: WebContents, viewBounds: Rectangle) {
    getFindBar(parent).open(target, viewBounds);
}

export function closeFindBar(parent: BrowserWindow, target?: WebContents) {
    findBarsByParent.get(parent)?.close(target);
}

export function updateFindBarBounds(parent: BrowserWindow, target: WebContents | undefined, viewBounds: Rectangle) {
    findBarsByParent.get(parent)?.updateBounds(target, viewBounds);
}

export class FindBar {
    private parent: BrowserWindow;
    private view: WebContentsView;
    private target?: WebContents;
    private lastQuery = '';
    private visible = false;
    private onFoundInPage: (event: Electron.Event, result: Electron.Result) => void;

    constructor(parent: BrowserWindow) {
        registerFindBarIpc();

        this.parent = parent;
        this.view = new WebContentsView({
            webPreferences: {
                preload: getLocalPreload('internalAPI.js'),
            },
        });
        this.view.setBackgroundColor('#00000000');
        this.view.setVisible(false);
        this.view.webContents.loadURL('mattermost-desktop://renderer/findBar.html');

        parent.contentView.addChildView(this.view);
        performanceMonitor.registerView(`FindBar-${parent.webContents.id}`, this.view.webContents);
        ThemeManager.registerMainWindowView(this.view.webContents);
        findBarsBySenderId.set(this.view.webContents.id, this);

        this.onFoundInPage = (_event, result) => {
            if (!result.finalUpdate) {
                return;
            }
            this.sendResult({
                activeMatchOrdinal: result.activeMatchOrdinal,
                matches: result.matches,
            });
        };

        parent.on('closed', this.destroy);
    }

    get isVisible() {
        return this.visible;
    }

    open = (target: WebContents, viewBounds: Rectangle) => {
        log.debug('open');

        const targetChanged = this.target !== target;
        if (this.target && targetChanged) {
            this.stopFind();
            this.unbindTarget();
        }

        this.target = target;
        if (targetChanged) {
            this.target.on('found-in-page', this.onFoundInPage);
        }
        this.setBounds(viewBounds);

        if (!this.isViewInFront()) {
            this.parent.contentView.addChildView(this.view);
        }

        this.view.setVisible(true);
        this.visible = true;

        const channel = this.lastQuery ? FIND_BAR_FOCUS : FIND_BAR_OPEN;
        this.view.webContents.send(channel);
        this.view.webContents.focus();
    };

    close = (target?: WebContents) => {
        if (target && this.target && target !== this.target) {
            return;
        }
        if (!this.visible && !this.target) {
            return;
        }

        log.debug('close');
        this.stopFind();
        this.unbindTarget();
        this.lastQuery = '';
        this.view.setVisible(false);
        this.visible = false;
    };

    updateBounds = (target: WebContents | undefined, viewBounds: Rectangle) => {
        if (!this.visible) {
            return;
        }
        if (target && this.target && target !== this.target) {
            return;
        }
        this.setBounds(viewBounds);
    };

    find = (text: string, options?: FindInPageOptions) => {
        if (!this.target || this.target.isDestroyed()) {
            return;
        }

        const query = text.trim();
        if (!query) {
            this.stopFind();
            this.lastQuery = '';
            this.sendResult({activeMatchOrdinal: 0, matches: 0});
            return;
        }

        const isNewSession = options?.findNext === true || query !== this.lastQuery;
        this.lastQuery = query;
        this.target.findInPage(query, {
            forward: options?.forward ?? true,
            findNext: isNewSession,
        });
    };

    findNext = () => {
        if (!this.lastQuery) {
            return;
        }
        this.find(this.lastQuery, {forward: true, findNext: false});
    };

    findPrevious = () => {
        if (!this.lastQuery) {
            return;
        }
        this.find(this.lastQuery, {forward: false, findNext: false});
    };

    destroy = () => {
        this.stopFind();
        this.unbindTarget();
        findBarsBySenderId.delete(this.view.webContents.id);
        performanceMonitor.unregisterView(this.view.webContents.id);
        this.view.webContents.close();
    };

    private setBounds = (viewBounds: Rectangle) => {
        const width = Math.min(FIND_BAR_WIDTH, Math.max(0, viewBounds.width - (FIND_BAR_MARGIN * 2)));
        this.view.setBounds({
            x: viewBounds.x + (viewBounds.width - width - FIND_BAR_MARGIN),
            y: viewBounds.y + FIND_BAR_MARGIN,
            width,
            height: FIND_BAR_HEIGHT,
        });
    };

    private stopFind = () => {
        if (this.target && !this.target.isDestroyed()) {
            this.target.stopFindInPage('clearSelection');
        }
    };

    private unbindTarget = () => {
        if (this.target && !this.target.isDestroyed()) {
            this.target.off('found-in-page', this.onFoundInPage);
        }
        this.target = undefined;
    };

    private sendResult = (result: FindBarResult) => {
        if (!this.view.webContents.isDestroyed()) {
            this.view.webContents.send(FIND_BAR_RESULT, result);
        }
    };

    private isViewInFront = () => {
        const index = this.parent.contentView.children.indexOf(this.view);
        return index === this.parent.contentView.children.length - 1;
    };
}
