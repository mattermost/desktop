// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ipcRenderer} from 'electron';
import electronContextMenu from 'electron-context-menu';


export default {
  setup(win, options) {
    const defaultOptions = {
      useSpellChecker: false,
    };
    const actualOptions = Object.assign({}, defaultOptions, options);
    electronContextMenu({
      window: win,
      prepend(params) {
        return [];
      },
    });
  },
};
