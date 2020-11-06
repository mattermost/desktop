// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as windowManager from '../windows/windowManager';

import {Mention} from './Mention';

export function displayMention(title, body, channel, teamId, silent, webcontents) {
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