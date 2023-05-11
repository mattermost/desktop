// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import BaseView from './BaseView';
import {ViewType, TAB_MESSAGING} from './View';

export default class MessagingView extends BaseView {
    get url(): URL {
        return this.server.url;
    }

    get type(): ViewType {
        return TAB_MESSAGING;
    }

    get shouldNotify(): boolean {
        return true;
    }
}
