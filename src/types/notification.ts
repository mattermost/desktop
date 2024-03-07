// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {NotificationConstructorOptions} from 'electron/common';

export type MentionOptions = NotificationConstructorOptions & {
    soundName: string;
}
