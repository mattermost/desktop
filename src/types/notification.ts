// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {NotificationConstructorOptions} from 'electron/main';

export type MentionData = {
    soundName: string;
}

export type MentionOptions = NotificationConstructorOptions & {
    data: MentionData;
}
