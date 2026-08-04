// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import TabManager from 'app/tabs/tabManager';
import WebContentsManager from 'app/views/webContentsManager';

export function getFocusedOrActiveTabView() {
    return WebContentsManager.getFocusedView() ?? TabManager.getCurrentActiveTabView();
}
