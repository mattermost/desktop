// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import electronContextMenu from 'electron-context-menu';

let disposeCurrent;
let menuOptions = {
  shouldShowMenu: (e, p) => {
    // TODO: remove copy link from internal links (like the team)
    const isInternalLink = p.linkURL.endsWith('#') && p.linkURL.slice(0, -1) === p.pageURL;
    let isInternalSrc;
    try {
      const srcurl = new URL(p.srcURL);
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
  const options = target ? {window: target, ...menuOptions} : menuOptions;
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
