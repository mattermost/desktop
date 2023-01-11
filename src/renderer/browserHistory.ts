// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createBrowserHistory} from 'history';

export const getHistory = () => {
    const history = createBrowserHistory();
    const originalPush = history.push;
    history.push = (path: string | { pathname: string }) => {
        window.mattermost.browserHistoryPush(typeof path === 'object' ? path.pathname : path);
    };

    window.mattermost.onBrowserHistoryPush((pathname: string) => {
        originalPush(pathname);
    });
    return history;
};
