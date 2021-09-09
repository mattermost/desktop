// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import BaseTabView from './BaseTabView';
import {TabType, TAB_MESSAGING} from './TabView';

export default class MessagingTabView extends BaseTabView {
    get url(): URL {
        return this.server.url;
    }

    get type(): TabType {
        return TAB_MESSAGING;
    }

    get shouldNotify(): boolean {
        return true;
    }
}
