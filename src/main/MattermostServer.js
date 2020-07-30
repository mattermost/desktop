// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {parseURL} from 'util/util';

export class Server {
  constructor(name, serverUrl) {
    this.name = name;
    this.url = parseURL(serverUrl);
    if (!this.url) {
      throw new Error('Invalid url for creating a server');
    }
  }

  getServerInfo = () => {
    // does the server have a subpath?
    const normalizedPath = this.url.pathname.toLowerCase();
    const subpath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
    return {origin: this.url.origin, subpath, url: this.url.toString()};
  }

  sameOrigin = (otherURL) => {
    const parsedUrl = parseURL(otherURL);
    return parsedUrl && this.url.origin === parsedUrl.origin;
  }
}