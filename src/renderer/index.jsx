// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/index.css';

if (process.env.NODE_ENV === 'production') {
  window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
    throw new Error('Sorry, Mattermost does not support window.eval() for security reasons.');
  };
} else if (module.hot) {
  module.hot.accept();
}

// TODO: enable again, but for the moment seems to conflict with electron-webpack
// window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
//   import 'bootstrap/dist/css/bootstrap.min.css';
//     throw new Error(`Sorry, ${remote.app.name} does not support window.eval() for security reasons.`);
//   };

import url from 'url';

import React from 'react';
import ReactDOM from 'react-dom';
import {ipcRenderer} from 'electron';

import {GET_CONFIGURATION, UPDATE_TEAMS} from '../common/config';

import EnhancedNotification from './js/notification';
import MainPage from './components/MainPage.jsx';

Notification = EnhancedNotification; // eslint-disable-line no-global-assign, no-native-reassign

// todo: should we block?
ipcRenderer.invoke(GET_CONFIGURATION).then((result) => {
  let config;
  let teams;
  const reloadConfig = (newConfig) => {
    config = newConfig;
    teams = config.teams;
  };

  reloadConfig(result);

  const parsedURL = url.parse(window.location.href, true);
  const initialIndex = parsedURL.query.index ? parseInt(parsedURL.query.index, 10) : getInitialIndex(teams);

  // TODO: why is this needed? removing for now
  //remote.getCurrentWindow().removeAllListeners('focus');

  // TODO: deep linking
  // let deeplinkingUrl = null;
  // if (!parsedURL.query.index || parsedURL.query.index === null) {
  //   deeplinkingUrl = remote.getCurrentWindow().deeplinkingUrl;
  // }
  const deeplinkingUrl = null;

  config.on('update', (configData) => {
    teams.splice(0, teams.length, ...configData.teams);
  });

  config.on('synchronize', () => {
    ipcRenderer.send('reload-config');
  });

  ipcRenderer.on('reload-config', () => {
    ipcRenderer.invoke(GET_CONFIGURATION).then(reloadConfig);
  });

  function teamConfigChange(updatedTeams, callback) {
    //config.set('teams', updatedTeams);
    ipcRenderer.invoke(UPDATE_TEAMS, updatedTeams).then((teamConfig) => {
      teams = teamConfig;
      config.teams = teamConfig;
    });
    if (callback) {
      config.once('update', callback);
    }
  }

  function moveTabs(originalOrder, newOrder) {
    const tabOrder = teams.concat().map((team, index) => {
      return {
        index,
        order: team.order,
      };
    }).sort((a, b) => (a.order - b.order));

    const team = tabOrder.splice(originalOrder, 1);
    tabOrder.splice(newOrder, 0, team[0]);

    let teamIndex;
    tabOrder.forEach((t, order) => {
      if (order === newOrder) {
        teamIndex = t.index;
      }
      teams[t.index].order = order;
    });
    teamConfigChange(teams);
    return teamIndex;
  }

  // TODO: can we remove the next two and use other mechanisms? like direct comm to ipcMain
  function getDarkMode() {
    if (process.platform !== 'darwin') {
      return config.darkMode;
    }
    return null;
  }

  function setDarkMode() {
    if (process.platform !== 'darwin') {
      const darkMode = Boolean(config.darkMode);
      config.set('darkMode', !darkMode);
      return !darkMode;
    }
    return null;
  }

  const component = (
    <MainPage
      teams={teams}
      localTeams={config.localTeams}
      initialIndex={initialIndex}
      onBadgeChange={showBadge}
      onTeamConfigChange={teamConfigChange}
      useSpellChecker={config.useSpellChecker}
      deeplinkingUrl={deeplinkingUrl}
      showAddServerButton={config.enableServerManagement}
      getDarkMode={getDarkMode}
      setDarkMode={setDarkMode}
      moveTabs={moveTabs}
      openMenu={openMenu}
    />);

  ReactDOM.render(
    component,
    document.getElementById('app')
  );
}); // todo: catch?

function getInitialIndex(teams) {
  const element = teams.find((e) => e.order === 0);
  return element ? teams.indexOf(element) : 0;
}

function openMenu() {
  if (process.platform !== 'darwin') {
    ipcRenderer.send('open-app-menu');
  }
}

function showBadge(sessionExpired, unreadCount, mentionCount) {
  ipcRenderer.send('update-unread', {
    sessionExpired,
    unreadCount,
    mentionCount,
  });
}

// Deny drag&drop navigation in mainWindow.
// Drag&drop is allowed in webview of index.html.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
