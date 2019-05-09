// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import url from 'url';

function getDomain(inputURL) {
  const parsedURL = url.parse(inputURL);
  return `${parsedURL.protocol}//${parsedURL.host}`;
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

export default {
  getDomain,
  isInternalURL,
};
