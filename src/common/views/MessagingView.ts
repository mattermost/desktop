// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import BaseView from './BaseView';
import type {ViewType} from './View';
import {TAB_MESSAGING} from './View';

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
