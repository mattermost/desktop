// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import {Config} from 'common/config';

const configPath = '/fake/config/path';
const appName = 'app-name';
const appPath = '/my/app/path';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
}));

jest.mock('common/Validator', () => ({
    validateV0ConfigData: (configData) => (configData.version === 0 ? configData : null),
    validateV1ConfigData: (configData) => (configData.version === 1 ? configData : null),
    validateV2ConfigData: (configData) => (configData.version === 2 ? configData : null),
    validateV3ConfigData: (configData) => (configData.version === 3 ? configData : null),
    validateConfigData: (configData) => (configData.version === 3 ? configData : null),
}));

jest.mock('common/views/View', () => ({
    getDefaultViewsForConfigServer: (value) => ({
        ...value,
        tabs: [
            {
                name: 'view1',
            },
            {
                name: 'view2',
            },
        ],
    }),
}));

const buildServer = {
    name: 'build-server-1',
    order: 0,
    url: 'http://build-server-1.com',
};

const buildServerWithViews = {
    ...buildServer,
    tabs: [
        {
            name: 'view1',
        },
        {
            name: 'view2',
        },
    ],
};

const registryServer = {
    name: 'registry-server-1',
    order: 0,
    url: 'http://registry-server-1.com',
};

const server = {
    name: 'server-1',
    order: 0,
    url: 'http://server-1.com',
    tabs: [
        {
            name: 'view1',
        },
        {
            name: 'view2',
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
        defaultServers: [buildServer],
    };
});

jest.mock('common/config/RegistryConfig', () => {
    return jest.fn();
});

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/valid/downloads/path'),
    },
}));

describe('common/config', () => {
    it('should load buildConfig', () => {
        const config = new Config();
        config.reload = jest.fn();
        config.init(configPath, appName, appPath);
        expect(config.predefinedServers).toContainEqual(buildServerWithViews);
    });

    describe('loadRegistry', () => {
        it('should load the registry items and reload the config', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.onLoadRegistry({servers: [registryServer]});
            expect(config.reload).toHaveBeenCalled();
            expect(config.predefinedServers).toContainEqual({
                ...registryServer,
                tabs: [
                    {
                        name: 'view1',
                    },
                    {
                        name: 'view2',
                    },
                ],
            });
        });
    });

    describe('reload', () => {
        it('should emit update event', () => {
            const config = new Config();
            config.init(configPath, appName, appPath);
            config.loadDefaultConfigData = jest.fn();
            config.loadBuildConfigData = jest.fn();
            config.loadLocalConfigFile = jest.fn();
            config.checkForConfigUpdates = jest.fn();
            config.regenerateCombinedConfigData = jest.fn().mockImplementation(() => {
                config.combinedData = {test: 'test'};
            });
            config.emit = jest.fn();
            fs.existsSync.mockReturnValue(true);

            config.reload();
            expect(config.emit).toHaveBeenNthCalledWith(1, 'update', {test: 'test'});
        });
    });

    describe('set', () => {
        it('should set an arbitrary value and save to local config data', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
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

        it('should not allow servers to be set using this method', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.localConfigData = {teams: [server]};
            config.regenerateCombinedConfigData = jest.fn().mockImplementation(() => {
                config.combinedData = {...config.localConfigData};
            });
            config.saveLocalConfigData = jest.fn();

            config.set('teams', [{...buildServerWithViews, name: 'build-team-2'}]);
            expect(config.localConfigData.teams).not.toContainEqual({...buildServerWithViews, name: 'build-team-2'});
            expect(config.localConfigData.teams).toContainEqual(server);
        });
    });

    describe('setServers', () => {
        it('should set only local servers', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.localConfigData = {};
            config.regenerateCombinedConfigData = jest.fn().mockImplementation(() => {
                config.combinedData = {...config.localConfigData};
            });
            config.saveLocalConfigData = jest.fn();

            config.setServers([{...buildServerWithViews, name: 'build-server-2'}, server], 0);
            expect(config.localConfigData.teams).toContainEqual({...buildServerWithViews, name: 'build-server-2'});
            expect(config.localConfigData.lastActiveTeam).toBe(0);
            expect(config.regenerateCombinedConfigData).toHaveBeenCalled();
            expect(config.saveLocalConfigData).toHaveBeenCalled();
        });
    });

    describe('saveLocalConfigData', () => {
        it('should emit update event on save', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
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
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
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
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
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
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
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
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.defaultConfigData = {test: 'test'};
            config.combinedData = {...config.localConfigData};
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Error message');
            });
            config.writeFile = jest.fn();

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({test: 'test'});
        });

        it('should use defaults if validation fails', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.defaultConfigData = {test: 'test'};
            config.combinedData = {...config.localConfigData};
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{"version": -1}');
            config.writeFile = jest.fn();

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({test: 'test'});
        });

        it('should return config data if valid', () => {
            const config = new Config();
            config.init(configPath, appName, appPath);
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{"version": 3}');
            config.writeFile = jest.fn();

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({version: 3});
        });
    });

    describe('checkForConfigUpdates', () => {
        it('should upgrade to latest version', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.defaultConfigData = {version: 10};
            config.writeFileSync = jest.fn();

            const configData = config.checkForConfigUpdates({version: 5, setting: 'true'});
            expect(configData).toStrictEqual({version: 10, setting: 'true'});
        });
    });

    describe('regenerateCombinedConfigData', () => {
        it('should combine config from all sources', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.defaultConfigData = {defaultSetting: 'default', otherDefaultSetting: 'default'};
            config.localConfigData = {otherDefaultSetting: 'local', localSetting: 'local', otherLocalSetting: 'local'};
            config.buildConfigData = {otherLocalSetting: 'build', buildSetting: 'build', otherBuildSetting: 'build'};
            config.registryConfigData = {otherBuildSetting: 'registry', registrySetting: 'registry'};

            config.regenerateCombinedConfigData();
            config.combinedData.darkMode = false;
            expect(config.combinedData).toStrictEqual({
                appName: 'app-name',
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

        it('should not include any servers in the combined config', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.defaultConfigData = {};
            config.localConfigData = {};
            config.buildConfigData = {enableServerManagement: true};
            config.registryConfigData = {};
            config.predefinedServers.push(server, server);
            config.localConfigData = {teams: [
                server,
                {
                    ...server,
                    name: 'local-server-2',
                    url: 'http://local-server-2.com',
                },
                {
                    ...server,
                    name: 'local-server-1',
                    order: 1,
                    url: 'http://local-server-1.com',
                },
            ]};

            config.regenerateCombinedConfigData();
            config.combinedData.darkMode = false;
            expect(config.combinedData).toStrictEqual({
                appName: 'app-name',
                darkMode: false,
                enableServerManagement: true,
            });
        });
    });
});
