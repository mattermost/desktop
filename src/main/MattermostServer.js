// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import urlUtils from 'common/utils/url';

export class MattermostServer {
    constructor(name, serverUrl) {
        this.name = name;
        this.url = urlUtils.parseURL(serverUrl);
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
        const parsedUrl = urlUtils.parseURL(otherURL);
        return parsedUrl && this.url.origin === parsedUrl.origin;
    }

    equals = (otherServer) => {
        return (this.name === otherServer.name) && (this.url.toString() === otherServer.url.toString());
    }
}
