// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import electronContextMenu from 'electron-context-menu';

let disposeCurrent;
let menuOptions;

function dispose() {
  if (disposeCurrent) {
    disposeCurrent();
    disposeCurrent = null;
  }
}

function saveOptions(options) {
  const providedOptions = options || {};
  const defaultOptions = {
    shouldShowMenu: (e, p) => {
      const isInternalLink = p.linkURL.endsWith('#') && p.linkURL.slice(0, -1) === p.pageURL;
      let isInternalSrc;
      try {
        const srcurl = new URL(p.srcURL);
        isInternalSrc = srcurl.protocol === 'file:';
        console.log(`srcurl protocol: ${srcurl.protocol}`);
      } catch (err) {
        isInternalSrc = false;
      }
      console.log(p);
      console.log(`should show spelling: ${p.isEditable && p.selectionText.length > 0 && p.misspelledWord}`);
      return p.isEditable || (p.mediaType !== 'none' && !isInternalSrc) || (p.linkURL !== '' && !isInternalLink) || p.misspelledWord !== '' || p.selectionText !== '';
    }
  };
  menuOptions = Object.assign({}, defaultOptions, providedOptions);
}

function reload(target) {
  dispose();
  const options = target ? {window: target, ...menuOptions} : menuOptions;
  disposeCurrent = electronContextMenu({window: target});
}

function setup(options) {
  saveOptions(options);
  dispose();
  disposeCurrent = electronContextMenu();
}

export default {
  setup,
  dispose,
  reload,
};
