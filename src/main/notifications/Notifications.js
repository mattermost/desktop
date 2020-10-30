// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {throttle} from 'underscore';

import osVersion from '../../common/osVersion';
import dingDataURL from '../../assets/ding.mp3'; // https://github.com/mattermost/platform/blob/v3.7.3/webapp/images/ding.mp3

const appIconURL = 'file://assets/appicon_48.png';

const playDing = throttle(() => {
  const ding = new Audio(dingDataURL);
  ding.play();
}, 3000, {trailing: false});

const defaultOptions = {
  title: 'Someone mentioned you',
  silent: false,
  icon: appIconURL,
  sound: dingDataURL,
  urgency: 'normal',
};

export default class MentionNotification {
  constructor(options) {

    if (process.platform === 'win32') {
      options.icon = appIconURL;
    }

  }
}