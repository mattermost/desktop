// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Config} from 'common/config';

const configPath = '/fake/config/path';
const appName = 'app-name';
const appPath = '/my/app/path';

const mockJsonFileManager = {
    json: {},
    setJson: jest.fn(),
    writeToFile: jest.fn().mockResolvedValue(undefined),
};

jest.mock('common/JsonFileManager', () => {
    return jest.fn().mockImplementation(() => mockJsonFileManager);
});

jest.mock('common/Validator', () => ({
    validateV0ConfigData: (configData) => (configData.version === 0 ? configData : null),
    validateV1ConfigData: (configData) => (configData.version === 1 ? configData : null),
    validateV2ConfigData: (configData) => (configData.version === 2 ? configData : null),
    validateV3ConfigData: (configData) => (configData.version === 3 ? configData : null),
    validateConfigData: (configData) => (configData.version === 3 ? configData : null),
}));

const buildServer = {
    name: 'build-server-1',
    order: 0,
    url: 'http://build-server-1.com',
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
        expect(config.predefinedServers).toContainEqual(buildServer);
    });

    describe('loadRegistry', () => {
        it('should load the registry items and reload the config', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.onLoadRegistry({servers: [registryServer]});
            expect(config.reload).toHaveBeenCalled();
            expect(config.predefinedServers).toContainEqual(registryServer);
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
            config.localConfigData = {servers: [server]};
            config.regenerateCombinedConfigData = jest.fn().mockImplementation(() => {
                config.combinedData = {...config.localConfigData};
            });
            config.saveLocalConfigData = jest.fn();

            config.set('servers', [{...buildServer, name: 'build-team-2'}]);
            expect(config.localConfigData.servers).not.toContainEqual({...buildServer, name: 'build-team-2'});
            expect(config.localConfigData.servers).toContainEqual(server);
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

            config.setServers([{...buildServer, name: 'build-server-2'}, server], 0);
            expect(config.localConfigData.servers).toContainEqual({...buildServer, name: 'build-server-2'});
            expect(config.localConfigData.lastActiveServer).toBe(0);
            expect(config.regenerateCombinedConfigData).toHaveBeenCalled();
            expect(config.saveLocalConfigData).toHaveBeenCalled();
        });
    });

    describe('saveLocalConfigData', () => {
        beforeEach(() => {
            mockJsonFileManager.setJson.mockClear();
            mockJsonFileManager.writeToFile.mockClear();
            mockJsonFileManager.writeToFile.mockResolvedValue(undefined);
        });

        it('should emit update event on save', async () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.json = mockJsonFileManager;
            config.localConfigData = {test: 'test', version: 3};
            config.combinedData = {...config.localConfigData};
            config.defaultConfigData = {version: 3};
            const updateListener = jest.fn();
            config.on('update', updateListener);

            config.saveLocalConfigData();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(mockJsonFileManager.setJson).toHaveBeenCalledWith({test: 'test', version: 3});
            expect(updateListener).toHaveBeenCalledWith({test: 'test', version: 3});
        });

        it('should emit error when writeToFile throws an error', async () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.json = mockJsonFileManager;
            config.localConfigData = {test: 'test', version: 3};
            config.combinedData = {...config.localConfigData};
            config.defaultConfigData = {version: 3};
            const error = {message: 'Error message'};
            mockJsonFileManager.writeToFile.mockRejectedValue(error);
            const errorListener = jest.fn();
            config.on('error', errorListener);

            config.saveLocalConfigData();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(errorListener).toHaveBeenCalledWith(error);
        });

        it('should retry once when file is locked', async () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.json = mockJsonFileManager;
            config.localConfigData = {test: 'test', version: 3};
            config.combinedData = {...config.localConfigData};
            config.defaultConfigData = {version: 3};
            const error = {code: 'EBUSY'};
            const errorListener = jest.fn();
            config.on('error', errorListener);

            let callCount = 0;
            mockJsonFileManager.writeToFile.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(error);
                }
                return Promise.resolve(undefined);
            });

            config.saveLocalConfigData();
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockJsonFileManager.writeToFile).toHaveBeenCalledTimes(2);
            expect(errorListener).not.toHaveBeenCalled();
        });

        it('should emit error if retry also fails with EBUSY', async () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.json = mockJsonFileManager;
            config.localConfigData = {test: 'test', version: 3};
            config.combinedData = {...config.localConfigData};
            config.defaultConfigData = {version: 3};
            const error = {code: 'EBUSY'};
            const errorListener = jest.fn();
            config.on('error', errorListener);

            mockJsonFileManager.writeToFile.mockRejectedValue(error);

            config.saveLocalConfigData();
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockJsonFileManager.writeToFile).toHaveBeenCalledTimes(2);
            expect(errorListener).toHaveBeenCalledWith(error);
        });
    });

    describe('loadLocalConfigFile', () => {
        beforeEach(() => {
            mockJsonFileManager.setJson.mockClear();
            mockJsonFileManager.writeToFile.mockClear();
            mockJsonFileManager.writeToFile.mockResolvedValue(undefined);
        });

        it('should use defaults if readFileSync fails', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.defaultConfigData = {test: 'test', version: 3};
            config.combinedData = {...config.localConfigData};
            mockJsonFileManager.json = {};

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({test: 'test', version: 3});
            expect(mockJsonFileManager.setJson).toHaveBeenCalledWith({test: 'test', version: 3});
        });

        it('should use defaults if validation fails', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.defaultConfigData = {test: 'test', version: 3};
            config.combinedData = {...config.localConfigData};
            mockJsonFileManager.json = {version: -1};

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({test: 'test', version: 3});
            expect(mockJsonFileManager.setJson).toHaveBeenCalledWith({test: 'test', version: 3});
        });

        it('should return config data if valid', () => {
            const config = new Config();
            config.init(configPath, appName, appPath);
            mockJsonFileManager.json = {version: 3};

            const configData = config.loadLocalConfigFile();
            expect(configData).toStrictEqual({version: 3});
        });
    });

    describe('checkForConfigUpdates', () => {
        beforeEach(() => {
            mockJsonFileManager.setJson.mockClear();
            mockJsonFileManager.writeToFile.mockClear();
            mockJsonFileManager.writeToFile.mockResolvedValue(undefined);
        });

        it('should upgrade to latest version', () => {
            const config = new Config();
            config.reload = jest.fn();
            config.init(configPath, appName, appPath);
            config.defaultConfigData = {version: 10};
            config.json = mockJsonFileManager;

            const configData = config.checkForConfigUpdates({version: 5, setting: 'true'});
            expect(configData).toStrictEqual({version: 10, setting: 'true'});
            expect(mockJsonFileManager.setJson).toHaveBeenCalledWith({version: 10, setting: 'true'});
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
            config.localConfigData = {servers: [
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
