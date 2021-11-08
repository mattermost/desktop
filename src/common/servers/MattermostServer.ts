// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import urlUtils from 'common/utils/url';

export class MattermostServer {
    name: string;
    url: URL;
    constructor(name: string, serverUrl: string) {
        this.name = name;
        this.url = urlUtils.parseURL(serverUrl)!;
        if (!this.url) {
            throw new Error('Invalid url for creating a server');
        }
    }
}
