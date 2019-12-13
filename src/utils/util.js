// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import url from 'url';

import electron from 'electron';
import {isUri, isHttpUri, isHttpsUri} from 'valid-url';

function getDomain(inputURL) {
  const parsedURL = url.parse(inputURL);
  return `${parsedURL.protocol}//${parsedURL.host}`;
}

function isValidURL(testURL) {
  return Boolean(isHttpUri(testURL) || isHttpsUri(testURL));
}

function isValidURI(testURL) {
  return Boolean(isUri(testURL));
}

// isInternalURL determines if the target url is internal to the application.
// - currentURL is the current url inside the webview
// - basename is the global export from the Mattermost application defining the subpath, if any
function isInternalURL(targetURL, currentURL, basename = '/') {
  if (targetURL.host !== currentURL.host) {
    return false;
  }

  if (!(targetURL.pathname || '/').startsWith(basename)) {
    return false;
  }

  return true;
}

function getDisplayBoundaries() {
  const {screen} = electron;

  const displays = screen.getAllDisplays();

  return displays.map((display) => {
    return {
      maxX: display.workArea.x + display.workArea.width,
      maxY: display.workArea.y + display.workArea.height,
      minX: display.workArea.x,
      minY: display.workArea.y,
      maxWidth: display.workArea.width,
      maxHeight: display.workArea.height,
    };
  });
}

export default {
  getDomain,
  isValidURL,
  isValidURI,
  isInternalURL,
  getDisplayBoundaries,
};
