// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import url from 'url';

import electron, {remote} from 'electron';
import log from 'electron-log';
import {isUri, isHttpUri, isHttpsUri} from 'valid-url';

import buildConfig from '../common/config/buildConfig';

function getDomain(inputURL) {
  const parsedURL = url.parse(inputURL);
  return `${parsedURL.protocol}//${parsedURL.host}`;
}

function isValidURL(testURL) {
  return Boolean(isHttpUri(testURL) || isHttpsUri(testURL)) && parseURL(testURL) !== null;
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

function getHost(inputURL) {
  const parsedURL = parseURL(inputURL);
  if (parsedURL) {
    return parsedURL.origin;
  }
  throw new Error(`Couldn't parse url: ${inputURL}`);
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

function getManagedResources() {
  if (!buildConfig) {
    return [];
  }

  return buildConfig.managedResources || [];
}

function isAdminUrl(serverUrl, inputUrl) {
  const parsedURL = parseURL(inputUrl);
  const server = getServerInfo(serverUrl);
  if (!parsedURL || !server || (!equalUrlsIgnoringSubpath(server, parsedURL))) {
    return null;
  }
  return (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}/admin_console/`) ||
    parsedURL.pathname.toLowerCase().startsWith('/admin_console/'));
}

function isTeamUrl(serverUrl, inputUrl, withApi) {
  const parsedURL = parseURL(inputUrl);
  const server = getServerInfo(serverUrl);
  if (!parsedURL || !server || (!equalUrlsIgnoringSubpath(server, parsedURL))) {
    return null;
  }

  // pre process nonTeamUrlPaths
  let nonTeamUrlPaths = [
    'plugins',
    'signup',
    'login',
    'admin',
    'channel',
    'post',
    'oauth',
    'admin_console',
  ];
  const managedResources = getManagedResources();
  nonTeamUrlPaths = nonTeamUrlPaths.concat(managedResources);

  if (withApi) {
    nonTeamUrlPaths.push('api');
  }
  return !(nonTeamUrlPaths.some((testPath) => (
    parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}${testPath}/`) ||
    parsedURL.pathname.toLowerCase().startsWith(`/${testPath}/`))));
}

function isPluginUrl(serverUrl, inputURL) {
  const server = getServerInfo(serverUrl);
  const parsedURL = parseURL(inputURL);
  if (!parsedURL || !server) {
    return false;
  }
  return (
    equalUrlsIgnoringSubpath(server, parsedURL) &&
    (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}plugins/`) ||
      parsedURL.pathname.toLowerCase().startsWith('/plugins/')));
}

function isManagedResource(serverUrl, inputURL) {
  const server = getServerInfo(serverUrl);
  const parsedURL = parseURL(inputURL);
  if (!parsedURL || !server) {
    return false;
  }

  const managedResources = getManagedResources();

  return (
    equalUrlsIgnoringSubpath(server, parsedURL) && managedResources && managedResources.length &&
    managedResources.some((managedResource) => (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}${managedResource}/`) || parsedURL.pathname.toLowerCase().startsWith(`/${managedResource}/`))));
}

function getServer(inputURL, teams) {
  const parsedURL = parseURL(inputURL);
  if (!parsedURL) {
    return null;
  }
  let parsedServerUrl;
  let secondOption = null;
  for (let i = 0; i < teams.length; i++) {
    parsedServerUrl = parseURL(teams[i].url);

    // check server and subpath matches (without subpath pathname is \ so it always matches)
    if (equalUrlsWithSubpath(parsedServerUrl, parsedURL)) {
      return {name: teams[i].name, url: parsedServerUrl, index: i};
    }
    if (equalUrlsIgnoringSubpath(parsedServerUrl, parsedURL)) {
      // in case the user added something on the path that doesn't really belong to the server
      // there might be more than one that matches, but we can't differentiate, so last one
      // is as good as any other in case there is no better match (e.g.: two subpath servers with the same origin)
      // e.g.: https://community.mattermost.com/core
      secondOption = {name: teams[i].name, url: parsedServerUrl, index: i};
    }
  }
  return secondOption;
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

// next two functions are defined to clarify intent
function equalUrlsWithSubpath(url1, url2) {
  return url1.origin === url2.origin && url2.pathname.toLowerCase().startsWith(url1.pathname.toLowerCase());
}

function equalUrlsIgnoringSubpath(url1, url2) {
  return url1.origin.toLowerCase() === url2.origin.toLowerCase();
}

const dispatchNotification = async (title, body, silent, data, handleClick) => {
  let permission;
  const appIconURL = `file:///${remote.app.getAppPath()}/assets/appicon_48.png`;
  if (Notification.permission === 'default') {
    permission = await Notification.requestPermission();
  } else {
    permission = Notification.permission;
  }

  if (permission !== 'granted') {
    log.error('Notifications not granted');
    return null;
  }

  const notification = new Notification(title, {
    body,
    tag: body,
    icon: appIconURL,
    requireInteraction: false,
    silent,
    data,
  });

  notification.onclick = handleClick;

  notification.onerror = () => {
    log.error('Notification failed to show');
  };

  return notification;
};

export default {
  getDomain,
  isValidURL,
  isValidURI,
  isInternalURL,
  parseURL,
  getServer,
  getServerInfo,
  isAdminUrl,
  isTeamUrl,
  isPluginUrl,
  isManagedResource,
  getDisplayBoundaries,
  dispatchNotification,
  getHost,
};
