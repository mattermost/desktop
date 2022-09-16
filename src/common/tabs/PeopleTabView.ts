// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getFormattedPathName} from 'common/utils/url';

import BaseTabView from './BaseTabView';
import {TabType, TAB_PEOPLE} from './TabView';

export default class PeopleTabView extends BaseTabView {
    get url(): URL {
        return new URL(`${this.server.url.origin}${getFormattedPathName(this.server.url.pathname)}people`);
    }

    get type(): TabType {
        return TAB_PEOPLE;
    }
}
