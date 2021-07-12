// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BaseServerTab, TabType, TAB_MESSAGING} from './ServerTab';

export class MessagingTab extends BaseServerTab {
    get url(): URL {
        return this.server.url;
    }

    get type(): TabType {
        return TAB_MESSAGING;
    }
}
