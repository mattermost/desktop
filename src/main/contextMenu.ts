// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow, BrowserView, WebviewTag, WebContents, ContextMenuParams, Event} from 'electron';
import type {Options} from 'electron-context-menu';
import electronContextMenu from 'electron-context-menu';

import {parseURL} from 'common/utils/url';

const defaultMenuOptions = {
    shouldShowMenu: (e: Event, p: ContextMenuParams) => {
        const isInternalLink = p.linkURL.endsWith('#') && p.linkURL.slice(0, -1) === p.pageURL;
        let isInternalSrc;
        try {
            const srcurl = parseURL(p.srcURL);
            isInternalSrc = srcurl?.protocol === 'mattermost-desktop:';
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
    view: BrowserWindow | BrowserView | WebviewTag | WebContents;
    menuOptions: Options;
    menuDispose?: () => void;

    constructor(options: Options, view: BrowserWindow | WebContents) {
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
    };

    reload = () => {
        this.dispose();

        const options = {window: this.view, ...this.menuOptions};
        this.menuDispose = electronContextMenu(options);
    };
}
