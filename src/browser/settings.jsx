// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {remote} from 'electron';

window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
  throw new Error(`Sorry, ${remote.app.getName()} does not support window.eval() for security reasons.`);
};

import React from 'react';
import ReactDOM from 'react-dom';

import SettingsPage from './components/SettingsPage.jsx';
import contextMenu from './js/contextMenu';

contextMenu.setup(remote.getCurrentWindow());

ReactDOM.render(
  <SettingsPage/>,
  document.getElementById('content')
);

// Deny drag&drop navigation in mainWindow.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
