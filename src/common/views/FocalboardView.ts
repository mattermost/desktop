// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getFormattedPathName} from 'common/utils/url';

import BaseView from './BaseView';
import type {ViewType} from './View';
import {TAB_FOCALBOARD} from './View';

export default class FocalboardView extends BaseView {
    get url(): URL {
        return new URL(`${this.server.url.origin}${getFormattedPathName(this.server.url.pathname)}boards`);
    }

    get type(): ViewType {
        return TAB_FOCALBOARD;
    }
}
