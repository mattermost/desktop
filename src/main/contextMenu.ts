// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow, ContextMenuParams, Event, WebContents} from 'electron';
import electronContextMenu, {Options} from 'electron-context-menu';

import urlUtils from 'common/utils/url';

const defaultMenuOptions = {
    shouldShowMenu: (e: Event, p: ContextMenuParams) => {
        const isInternalLink = p.linkURL.endsWith('#') && p.linkURL.slice(0, -1) === p.pageURL;
        let isInternalSrc;
        try {
            const srcurl = urlUtils.parseURL(p.srcURL);
            isInternalSrc = srcurl?.protocol === 'file:';
        } catch (err) {
            isInternalSrc = false;
        }
        return p.isEditable || (p.mediaType !== 'none' && !isInternalSrc) || (p.linkURL !== '' && !isInternalLink) || p.misspelledWord !== '' || p.selectionText !== '';
    },
    showLookUpSelection: true,
    showSearchWithGoogle: true,
    showCopyImage: true,
    showSaveImage: true,
    showSaveImageAs: true,
    showServices: true,
};

export default class ContextMenu {
    view: BrowserWindow | BrowserView;
    menuOptions: Options;
    menuDispose?: () => void;

    constructor(options: Options, view: BrowserWindow | BrowserView) {
        const providedOptions: Options = options || {};

        this.menuOptions = Object.assign({}, defaultMenuOptions, providedOptions);
        this.view = view;

        this.reload();
    }

    dispose = () => {
        if (this.menuDispose) {
            this.menuDispose();
            delete this.menuDispose;
        }
    }

    reload = () => {
        this.dispose();

        /**
         * Work-around issue with passing `WebContents` to `electron-context-menu` in Electron 11
         * @see https://github.com/sindresorhus/electron-context-menu/issues/123
         */
        const options = {window: {webContents: this.view.webContents, inspectElement: this.view.webContents.inspectElement.bind(this.view.webContents), isDestroyed: this.view.webContents.isDestroyed.bind(this.view.webContents), off: this.view.webContents.off.bind(this.view.webContents)} as unknown as WebContents, ...this.menuOptions};
        this.menuDispose = electronContextMenu(options);
    }
}
