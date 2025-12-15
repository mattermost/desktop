// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode, ComponentType, ComponentProps} from 'react';

import type {CurrentConfig} from './config';

export type SaveQueueItem = {
    key: keyof CurrentConfig;
    data: CurrentConfig[keyof CurrentConfig];
};

export type DeveloperSettings = {
    browserOnly?: boolean;
    disableNotificationStorage?: boolean;
    disableUserActivityMonitor?: boolean;
    disableContextMenu?: boolean;
    disableDevTools?: boolean;
};

export type SettingsDefinition = Record<string, SettingCategory>;
export type SettingCategory = {
    title: ReactNode;
    icon: string;
    settings: Setting[];
};
export type Setting = {
    id: keyof CurrentConfig;
    component: ComponentType<any>;
    condition?: boolean;
    props?: ComponentProps<Setting['component']>;
};
