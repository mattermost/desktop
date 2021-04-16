// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import electronContextMenu from 'electron-context-menu';

import urlUtils from 'common/utils/url';

const defaultMenuOptions = {
    shouldShowMenu: (e, p) => {
        const isInternalLink = p.linkURL.endsWith('#') && p.linkURL.slice(0, -1) === p.pageURL;
        let isInternalSrc;
        try {
            const srcurl = urlUtils.parseURL(p.srcURL);
            isInternalSrc = srcurl.protocol === 'file:';
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
    constructor(options, view) {
        const providedOptions = options || {};

        this.menuOptions = Object.assign({}, defaultMenuOptions, providedOptions);
        this.view = view;

        this.reload();
    }

    dispose = () => {
        if (this.menuDispose) {
            this.menuDispose();
            this.menuDispose = null;
        }
    }

    reload = () => {
        this.dispose();

        /**
         * Work-around issue with passing `WebContents` to `electron-context-menu` in Electron 11
         * @see https://github.com/sindresorhus/electron-context-menu/issues/123
         */
        const options = {window: {webContents: this.view.webContents, inspectElement: this.view.webContents.inspectElement.bind(this.view.webContents), isDestroyed: this.view.webContents.isDestroyed.bind(this.view.webContents), off: this.view.webContents.off.bind(this.view.webContents)}, ...this.menuOptions};
        this.menuDispose = electronContextMenu(options);
    }
}
