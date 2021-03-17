// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import electronContextMenu from 'electron-context-menu';

import urlUtils from 'common/utils/url';

let disposeCurrent;
let menuOptions = {
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

function dispose() {
    if (disposeCurrent) {
        disposeCurrent();
        disposeCurrent = null;
    }
}

function saveOptions(options) {
    const providedOptions = options || {};

    menuOptions = Object.assign({}, menuOptions, providedOptions);
}

function reload(target) {
    dispose();

    /**
     * Work-around issue with passing `WebContents` to `electron-context-menu` in Electron 11
     * @see https://github.com/sindresorhus/electron-context-menu/issues/123
     */
    const options = target ? {window: {webContents: target, inspectElement: target.inspectElement.bind(target), isDestroyed: target.isDestroyed.bind(target), off: target.off.bind(target)}, ...menuOptions} : menuOptions;
    disposeCurrent = electronContextMenu(options);
}

function setup(options) {
    saveOptions(options);
    dispose();
    disposeCurrent = electronContextMenu(menuOptions);
}

export default {
    setup,
    dispose,
    reload,
};
