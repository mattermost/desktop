// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ConfigV2, ConfigV1, ConfigV0, AnyConfig} from 'types/config';

import pastDefaultPreferences from './pastDefaultPreferences';

function deepCopy<T>(object: T): T {
    return JSON.parse(JSON.stringify(object));
}

function upgradeV0toV1(configV0: ConfigV0) {
    const config = deepCopy(pastDefaultPreferences[1]);
    config.teams.push({
        name: 'Primary team',
        url: configV0.url,
    });
    return config;
}

function upgradeV1toV2(configV1: ConfigV1) {
    const config = Object.assign({}, deepCopy<ConfigV2>(pastDefaultPreferences[2]), configV1);
    config.version = 2;
    config.teams = configV1.teams.map((value, index) => {
        return {
            ...value,
            order: index,
        };
    });
    return config;
}

export default function upgradeToLatest(config: AnyConfig): ConfigV2 {
    switch (config.version) {
    case 2:
        return config as ConfigV2;
    case 1:
        return upgradeToLatest(upgradeV1toV2(config as ConfigV1));
    default:
        return upgradeToLatest(upgradeV0toV1(config as ConfigV0));
    }
}
