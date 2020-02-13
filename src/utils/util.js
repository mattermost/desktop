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

function parseURL(inputURL) {
  if (!inputURL) {
    return null;
  }
  if (inputURL instanceof URL) {
    return inputURL;
  }
  try {
    return new URL(inputURL);
  } catch (e) {
    return null;
  }
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

function getServerInfo(serverUrl) {
  const parsedServer = parseURL(serverUrl);
  if (!parsedServer) {
    return null;
  }

  // does the server have a subpath?
  const pn = parsedServer.pathname.toLowerCase();
  const subpath = pn.endsWith('/') ? pn.toLowerCase() : `${pn}/`;
  return {origin: parsedServer.origin, subpath, url: parsedServer};
}

function isTeamUrl(serverUrl, inputUrl, withApi) {
  const parsedURL = parseURL(inputUrl);
  const server = getServerInfo(serverUrl);
  if (!parsedURL || !server) {
    return null;
  }
  if (server.origin !== parsedURL.origin) {
    return null;
  }
  const nonTeamUrlPaths = ['plugins', 'signup', 'login', 'admin', 'channel', 'post', 'oauth', 'admin_console'];
  if (withApi) {
    nonTeamUrlPaths.push('api');
  }
  return !(nonTeamUrlPaths.some((testPath) => parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}${testPath}/`)));
}

function isPluginUrl(serverUrl, inputURL) {
  const server = getServerInfo(serverUrl);
  const parsedURL = parseURL(inputURL);
  if (!parsedURL || !server) {
    return false;
  }
  return server.origin === parsedURL.origin && parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}plugins/`);
}

function getServer(inputURL, teams) {
  const parsedURL = parseURL(inputURL);
  if (!parsedURL) {
    return null;
  }
  let parsedServerUrl;
  for (let i = 0; i < teams.length; i++) {
    parsedServerUrl = parseURL(teams[i].url);

    // check server and subpath matches (without subpath pathname is \ so it always matches)
    if (parsedServerUrl.origin === parsedURL.origin && parsedURL.pathname.startsWith(parsedServerUrl.pathname)) {
      return {name: teams[i].name, url: parsedServerUrl, index: i};
    }
  }
  return null;
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
  parseURL,
  getServer,
  isTeamUrl,
  isPluginUrl,
  getDisplayBoundaries,
};
