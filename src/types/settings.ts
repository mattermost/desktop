// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode, ComponentType, ComponentProps} from 'react';

import type {Config} from './config';

export type SaveQueueItem = {
    key: keyof Config;
    data: Config[keyof Config];
};

export type DeveloperSettings = {
    browserOnly?: boolean;
    disableNotificationStorage?: boolean;
    disableUserActivityMonitor?: boolean;
    disableContextMenu?: boolean;
};

export type SettingsDefinition = Record<string, SettingCategory>;
export type SettingCategory = {
    title: ReactNode;
    icon: string;
    settings: Setting[];
};
export type Setting = {
    id: keyof Config;
    component: ComponentType<any>;
    condition?: boolean;
    props?: ComponentProps<Setting['component']>;
};
