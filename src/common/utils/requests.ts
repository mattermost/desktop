// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as http from 'http';
import * as https from 'https';

type Method = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'OPTIONS' | 'HEAD';

export async function ping(url: URL, method: Method = 'GET'): Promise<http.ServerResponse> {
    const f = url.protocol === 'http:' ? http.request : https.request;
    return new Promise((yes, no) => {
        const req = f(url, {method});
        req.on('error', no);
        req.on('response', yes);
        req.end();
    });
}
