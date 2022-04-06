// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Config} from 'common/config';

const configPath = '/fake/config/path';

jest.mock('electron', () => ({
    app: {
        name: 'Mattermost',
        getPath: jest.fn(),
        getAppPath: () => '/path/to/app',
    },
    ipcMain: {
        on: jest.fn(),
    },
    nativeTheme: {
        shouldUseDarkColors: false,
    },
}));

jest.mock('main/Validator', () => ({
    validateV0ConfigData: (configData) => (configData.version === 0 ? configData : null),
    validateV1ConfigData: (configData) => (configData.version === 1 ? configData : null),
    validateV2ConfigData: (configData) => (configData.version === 2 ? configData : null),
    validateV3ConfigData: (configData) => (configData.version === 3 ? configData : null),
}));

jest.mock('common/tabs/TabView', () => ({
    getDefaultTeamWithTabsFromTeam: (value) => ({
        ...value,
        tabs: [
            {
                name: 'tab1',
            },
            {
                name: 'tab2',
            },
        ],
    }),
}));

const buildTeam = {
    name: 'build-team-1',
    order: 0,
    url: 'http://build-team-1.com',
};

const buildTeamWithTabs = {
    ...buildTeam,
    tabs: [
        {
            name: 'tab1',
        },
        {
            name: 'tab2',
        },
    ],
};

const registryTeam = {
    name: 'registry-team-1',
    order: 0,
    url: 'http://registry-team-1.com',
};

const team = {
    name: 'team-1',
    order: 0,
    url: 'http://team-1.com',
    tabs: [
        {
            name: 'tab1',
        },
        {
            name: 'tab2',
        },
    ],
};

jest.mock('common/config/upgradePreferences', () => {
    return jest.fn().mockImplementation((configData) => {
        return {...configData, version: 10};
    });
});

jest.mock('common/config/migrationPreferences', () => jest.fn());

jest.mock('common/config/buildConfig', () => {
    return {
        defaultTeams: [buildTeam],
    };
});

jest.mock('common/config/RegistryConfig', () => {
    return jest.fn();
});

describe('common/config', () => {
    it('should load buildConfig', () => {
        const config = new Config(configPath);
        expect(config.predefinedTeams).toContainEqual(buildTeamWithTabs);
    });

    describe('loadRegistry', () => {
        it('should load the registry items and reload the config', () => {
            const config = new Config(configPath);
            config.reload = jest.fn();
            config.loadRegistry({teams: [registryTeam]});
            expect(config.reload).toHaveBeenCalled();
            expect(config.predefinedTeams).toContainEqual({
                ...registryTeam,
                tabs: [
                    {
                        name: 'tab1',
                    },
                    {
                        name: 'tab2',
                    },
                ],
            });
        });
    });

    describe('reload', () => {
        it('should emit update event', () => {
            const config = new Config(configPath);
            config.loadDefaultConfigData = jest.fn();
            config.loadBuildConfigData = jest.fn();
            config.loadLocalConfigFile = jest.fn();
            config.checkForConfigUpdates = jest.fn();
            config.regenerateCombinedConfigData = jest.fn().mockImplementation(() => {
                config.combinedData = {test: 'test'};
            });
            config.emit = jest.fn();

            config.reload();
            expect(config.emit).toHaveBeenNthCalledWith(1, 'update', {test: 'test'});
        });
    });

    describe('set', () => {
        it('should set an arbitrary value and save to local config data', () => {
            const config = new Config(configPath);
            config.localConfigData = {};
            config.regenerateCombinedConfigData = jest.fn().mockImplementation(() => {
                config.combinedData = {...config.localConfigData};
            });
            config.saveLocalConfigData = jest.fn();

            config.set('setting', 'test_value_1');
            expect(config.combinedData.setting).toBe('test_value_1');
            expect(config.regenerateCombinedConfigData).toHaveBeenCalled();
            expect(config.saveLocalConfigData).toHaveBeenCalled();
        });

        it('should set teams without including predefined', () => {
            const config = new Config(configPath);
            config.localConfigData = {};
            config.regenerateCombinedConfigData = jest.fn().mockImplementation(() => {
                config.combinedData = {...config.localConfigData};
            });
            config.saveLocalConfigData = jest.fn();

            config.set('teams', [{...buildTeamWithTabs, name: 'build-team-2'}, team]);
            expect(config.localConfigData.teams).not.toContainEqual({...buildTeamWithTabs, name: 'build-team-2'});
            expect(config.localConfigData.teams).toContainEqual(team);
            expect(config.predefinedTeams).toContainEqual({...buildTeamWithTabs, name: 'build-team-2'});
        });
    });

    describe('saveLocalConfigData', () => {
        it('should emit update event on save', () => {
            const config = new Config(configPath);
            config.localConfigData = {test: 'test'};
            config.combinedData = {...config.localConfigData};
            config.writeFile = jest.fn().mockImplementation((configFilePath, data, callback) => {
                callback();
            });
            config.emit = jest.fn();

            config.saveLocalConfigData();
            expect(config.emit).toHaveBeenNthCalledWith(1, 'update', {test: 'test'});
        });

        it('should emit error when fs.writeSync throws an error', () => {
            const config = new Config(configPath);
            config.localConfigData = {test: 'test'};
            config.combinedData = {...config.localConfigData};
            config.writeFile = jest.fn().mockImplementation((configFilePath, data, callback) => {
                callback({message: 'Error message'});
            });
            config.emit = jest.fn();

            config.saveLocalConfigData();
            expect(config.emit).toHaveBeenNthCalledWith(1, 'error', {message: 'Error message'});
        });

        it('should emit error when writeFile throws an error', () => {
            const config = new Config(configPath);
            config.localConfigData = {test: 'test'};
            config.combinedData = {...config.localConfigData};
            config.writeFile = jest.fn().mockImplementation(() => {
                throw new Error('Error message');
            });
            config.emit = jest.fn();

            config.saveLocalConfigData();
            expect(config.emit).toHaveBeenNthCalledWith(1, 'error', new Error('Error message'));
        });

        it('should retry when file is locked', () => {
            const testFunc = jest.fn();
            const config = new Config(configPath);
            config.localConfigData = {test: 'test'};
            config.combinedData = {...config.localConfigData};
            config.writeFile = jest.fn().mockImplementation((configFilePath, data, callback) => {
                config.saveLocalConfigData = testFunc;
                callback({code: 'EBUSY'});
            });
            config.emit = jest.fn();

            config.saveLocalConfigData();
            expect(testFunc).toHaveBeenCalled();
        });
    });

    describe('loadLocalConfigFile', () => {
        it('should use defaults if readFileSync fails', () => {
            const config = new Config(configPath);
            config.defaultConfigData = {test: 'test'};
            config.combinedData = {...config.localConfigData};
            config.readFileSync = jest.fn().mockImplementation(() => {
                throw new Error('Error message');
            });
            config.writeFileSync = jest.fn();

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({test: 'test'});
        });

        it('should use defaults if validation fails', () => {
            const config = new Config(configPath);
            config.defaultConfigData = {test: 'test'};
            config.combinedData = {...config.localConfigData};
            config.readFileSync = jest.fn().mockImplementation(() => {
                return {version: -1};
            });
            config.writeFileSync = jest.fn();

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({test: 'test'});
        });

        it('should return config data if valid', () => {
            const config = new Config(configPath);
            config.readFileSync = jest.fn().mockImplementation(() => {
                return {version: 3};
            });
            config.writeFileSync = jest.fn();

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({version: 3});
        });
    });

    describe('checkForConfigUpdates', () => {
        it('should upgrade to latest version', () => {
            const config = new Config(configPath);
            config.defaultConfigData = {version: 10};
            config.writeFileSync = jest.fn();

            const configData = config.checkForConfigUpdates({version: 5, setting: 'true'});
            expect(configData).toStrictEqual({version: 10, setting: 'true'});
        });
    });

    describe('regenerateCombinedConfigData', () => {
        it('should combine config from all sources', () => {
            const config = new Config(configPath);
            config.predefinedTeams = [];
            config.useNativeWindow = false;
            config.defaultConfigData = {defaultSetting: 'default', otherDefaultSetting: 'default'};
            config.localConfigData = {otherDefaultSetting: 'local', localSetting: 'local', otherLocalSetting: 'local'};
            config.buildConfigData = {otherLocalSetting: 'build', buildSetting: 'build', otherBuildSetting: 'build'};
            config.registryConfigData = {otherBuildSetting: 'registry', registrySetting: 'registry'};

            config.regenerateCombinedConfigData();
            config.combinedData.darkMode = false;
            expect(config.combinedData).toStrictEqual({
                teams: [],
                registryTeams: [],
                appName: 'Mattermost',
                useNativeWindow: false,
                darkMode: false,
                otherBuildSetting: 'registry',
                registrySetting: 'registry',
                otherLocalSetting: 'build',
                buildSetting: 'build',
                otherDefaultSetting: 'local',
                localSetting: 'local',
                defaultSetting: 'default',
            });
        });

        it('should combine teams from all sources and filter duplicates', () => {
            const config = new Config(configPath);
            config.defaultConfigData = {};
            config.localConfigData = {};
            config.buildConfigData = {enableServerManagement: true};
            config.registryConfigData = {};
            config.predefinedTeams = [team, team];
            config.useNativeWindow = false;
            config.localConfigData = {teams: [
                team,
                {
                    ...team,
                    name: 'local-team-2',
                    url: 'http://local-team-2.com',
                },
                {
                    ...team,
                    name: 'local-team-1',
                    order: 1,
                    url: 'http://local-team-1.com',
                },
            ]};

            config.regenerateCombinedConfigData();
            config.combinedData.darkMode = false;
            expect(config.combinedData).toStrictEqual({
                teams: [
                    team,
                    {
                        ...team,
                        name: 'local-team-2',
                        order: 1,
                        url: 'http://local-team-2.com',
                    },
                    {
                        ...team,
                        name: 'local-team-1',
                        order: 2,
                        url: 'http://local-team-1.com',
                    },
                ],
                registryTeams: [],
                appName: 'Mattermost',
                useNativeWindow: false,
                darkMode: false,
                enableServerManagement: true,
            });
        });

        it('should not include local teams if enableServerManagement is false', () => {
            const config = new Config(configPath);
            config.defaultConfigData = {};
            config.localConfigData = {};
            config.buildConfigData = {enableServerManagement: false};
            config.registryConfigData = {};
            config.predefinedTeams = [team, team];
            config.useNativeWindow = false;
            config.localConfigData = {teams: [
                team,
                {
                    ...team,
                    name: 'local-team-1',
                    order: 1,
                    url: 'http://local-team-1.com',
                },
            ]};

            config.regenerateCombinedConfigData();
            config.combinedData.darkMode = false;
            expect(config.combinedData).toStrictEqual({
                teams: [team],
                registryTeams: [],
                appName: 'Mattermost',
                useNativeWindow: false,
                darkMode: false,
                enableServerManagement: false,
            });
        });
    });
});
