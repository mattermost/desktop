// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CombinedConfig} from './config';

export type SaveQueueItem = {
    configType: 'updates' | 'appOptions';
    key: keyof CombinedConfig;
    data: CombinedConfig[keyof CombinedConfig];
};
