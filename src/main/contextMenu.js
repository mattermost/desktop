// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import electronContextMenu from 'electron-context-menu';

export default {
  setup(options) {
    const defaultOptions = {
      useSpellChecker: options.useSpellChecker,
      shouldShowMenu: (e, p) => {
        const isInternalLink = p.linkURL.endsWith('#') && p.linkURL.slice(0, -1) === p.pageURL;
        let isInternalSrc;
        try {
          const srcurl = new URL(p.srcURL);
          isInternalSrc = srcurl.protocol === 'file:';
          console.log(`srcrurl protocol: ${srcurl.protocol}`);
        } catch (err) {
          console.log(`ups: ${err}`);
          isInternalSrc = false;
        }
        return p.isEditable || (p.mediaType !== 'none' && !isInternalSrc) || (p.linkURL !== '' && !isInternalLink) || p.misspelledWord !== '' || p.selectionText !== '';
      }
    };
    const actualOptions = Object.assign({}, defaultOptions, options);

    electronContextMenu(actualOptions);
  },
};
