// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConfigV4, ConfigV3, ConfigV2, ConfigV1, ConfigV0, AnyConfig} from 'types/config';

import pastDefaultPreferences from './pastDefaultPreferences';

function deepCopy<T>(object: T): T {
    return JSON.parse(JSON.stringify(object));
}

export function upgradeV0toV1(configV0: ConfigV0) {
    const config = deepCopy(pastDefaultPreferences[1]);
    config.teams.push({
        name: 'Primary server',
        url: configV0.url,
    });
    return config;
}

export function upgradeV1toV2(configV1: ConfigV1) {
    const config: ConfigV2 = Object.assign({}, deepCopy<ConfigV2>(pastDefaultPreferences[2]), configV1);
    config.version = 2;
    config.teams = configV1.teams.map((value, index) => {
        return {
            ...value,
            order: index,
        };
    });
    return config;
}

export function upgradeV2toV3(configV2: ConfigV2) {
    const config: ConfigV3 = Object.assign({}, deepCopy<ConfigV3>(pastDefaultPreferences[3]), {...configV2, spellCheckerLocale: undefined});
    config.version = 3;
    config.teams = configV2.teams.map((value) => {
        return {
            ...value,
            tabs: [
                {
                    name: 'channels',
                    order: 0,
                    isOpen: true,
                },
            ],
        };
    });
    config.lastActiveTeam = 0;
    config.spellCheckerLocales = [configV2.spellCheckerLocale];
    config.startInFullscreen = false;
    return config;
}

export function upgradeV3toV4(configV3: ConfigV3) {
    const config: ConfigV4 = Object.assign({}, deepCopy<ConfigV4>(pastDefaultPreferences[4]), {...configV3, lastActiveTeam: undefined, teams: undefined});
    config.version = 4;
    config.servers = configV3.teams.map((team) => {
        return {
            name: team.name,
            url: team.url,
            order: team.order,
        };
    });
    config.lastActiveServer = configV3.lastActiveTeam;
    config.viewLimit = 15;
    config.themeSyncing = true;
    return config;
}

export default function upgradeToLatest(config: AnyConfig): ConfigV4 {
    switch (config.version) {
    case 4:
        return config as ConfigV4;
    case 3:
        return upgradeToLatest(upgradeV3toV4(config as ConfigV3));
    case 2:
        return upgradeToLatest(upgradeV2toV3(config as ConfigV2));
    case 1:
        return upgradeToLatest(upgradeV1toV2(config as ConfigV1));
    default:
        return upgradeToLatest(upgradeV0toV1(config as ConfigV0));
    }
}
