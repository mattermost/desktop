// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import BaseTabView from './BaseTabView';
import {TabType, TAB_FOCALBOARD} from './TabView';

export default class FocalboardTabView extends BaseTabView {
    get url(): URL {
        return this.server.url;
    }

    get type(): TabType {
        return TAB_FOCALBOARD;
    }
}
