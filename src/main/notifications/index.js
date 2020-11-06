// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell, Notification} from 'electron';

import * as windowManager from '../windows/windowManager';

import {Mention} from './Mention';
import {DownloadNotification} from './Download';

export function displayMention(title, body, channel, teamId, silent, webcontents) {
  if (!Notification.isSupported()) {
    console.log('notification not supported');
    return;
  }
  const options = {
    title,
    body,
    silent
  };
  const mention = new Mention(options);

  mention.on('show', (e) => {
    mention.onShow(e);
    windowManager.flashFrame(true);
  });

  mention.on('click', () => {
    const serverName = windowManager.getServerNameByWebContentsId(webcontents.id);
    console.log(`notification clicked! redirecting to ${serverName}`);
    if (serverName) {
      windowManager.switchServer(serverName, true);
      webcontents.send('notification-clicked', {channel, teamId});
    }
  });
  mention.show();
}

export function displayDownloadCompleted(fileName, path, serverInfo) {
  if (!Notification.isSupported()) {
    console.log('notification not supported');
    return;
  }
  const download = new DownloadNotification(fileName, serverInfo);

  download.on('show', () => {
    windowManager.flashFrame(true);
  });

  download.on('click', () => {
    shell.showItemInFolder(path.normalize());
  });
  download.show();
}