// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import path from 'path';

import {EventEmitter} from 'events';

import {Logger} from 'common/log';
import {copy} from 'common/utils/util';
import * as Validator from 'common/Validator';
import {getDefaultViewsForConfigServer} from 'common/views/View';

import type {
    AnyConfig,
    BuildConfig,
    CombinedConfig,
    ConfigServer,
    Config as ConfigType,
    RegistryConfig as RegistryConfigType,
} from 'types/config';

import buildConfig from './buildConfig';
import defaultPreferences, {getDefaultDownloadLocation} from './defaultPreferences';
import migrateConfigItems from './migrationPreferences';
import RegistryConfig, {REGISTRY_READ_EVENT} from './RegistryConfig';
import upgradeConfigData from './upgradePreferences';

const log = new Logger('Config');

export class Config extends EventEmitter {
    private configFilePath?: string;
    private appName?: string;
    private appPath?: string;

    private registryConfig: RegistryConfig;
    private _predefinedServers: ConfigServer[];

    private combinedData?: CombinedConfig;
    private localConfigData?: ConfigType;
    private registryConfigData?: Partial<RegistryConfigType>;
    private defaultConfigData?: ConfigType;
    private buildConfigData?: BuildConfig;
    private canUpgradeValue?: boolean;

    constructor() {
        super();
        this.registryConfig = new RegistryConfig();
        this._predefinedServers = [];
        if (buildConfig.defaultServers) {
            this._predefinedServers.push(...buildConfig.defaultServers.map((server, index) => getDefaultViewsForConfigServer({...server, order: index})));
        }
    }

    init = (configFilePath: string, appName: string, appPath: string) => {
        this.configFilePath = configFilePath;
        this.appName = appName;
        this.appPath = appPath;
        this.canUpgradeValue = this.checkWriteableApp();

        this.reload();
    };

    initRegistry = () => {
        if (process.platform !== 'win32') {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.registryConfig = new RegistryConfig();
            this.registryConfig.once(REGISTRY_READ_EVENT, (data) => {
                this.onLoadRegistry(data);
                resolve();
            });
            this.registryConfig.init();
        });
    };

    /**
     * Reload all sources of config data
     *
     * @emits {update} emitted once all data has been loaded and merged
     */
    reload = (): void => {
        this.defaultConfigData = copy(defaultPreferences);
        this.buildConfigData = copy(buildConfig);

        const loadedConfig = this.loadLocalConfigFile();
        this.localConfigData = this.checkForConfigUpdates(loadedConfig);

        this.regenerateCombinedConfigData();

        this.emit('update', this.combinedData);
    };

    /*********************
     * Setters and Getters
     *********************/

    /**
     * Used to save a single config property
     *
     * @param {string} key name of config property to be saved
     * @param {*} data value to save for provided key
     */
    set = (key: keyof ConfigType, data: ConfigType[keyof ConfigType]): void => {
        log.debug('set');
        this.setMultiple({[key]: data});
    };

    setConfigPath = (configPath: string) => {
        this.configFilePath = configPath;
    };

    /**
     * Used to save an array of config properties in one go
     *
     * @param {array} properties an array of config properties to save
     */
    setMultiple = (newData: Partial<ConfigType>) => {
        log.debug('setMultiple', newData);

        if (newData.darkMode && newData.darkMode !== this.darkMode) {
            this.emit('darkModeChange', newData.darkMode);
        }
        this.localConfigData = Object.assign({}, this.localConfigData, {...newData, teams: this.localConfigData?.teams});
        this.regenerateCombinedConfigData();
        this.saveLocalConfigData();
    };

    setServers = (servers: ConfigServer[], lastActiveServer?: number) => {
        log.debug('setServers', servers, lastActiveServer);

        this.localConfigData = Object.assign({}, this.localConfigData, {teams: servers, lastActiveTeam: lastActiveServer ?? this.localConfigData?.lastActiveTeam});
        this.regenerateCombinedConfigData();
        this.saveLocalConfigData();
    };

    // getters for accessing the various config data inputs

    get data() {
        return this.combinedData;
    }
    get localData() {
        return this.localConfigData ?? defaultPreferences;
    }
    get defaultData() {
        return this.defaultConfigData ?? defaultPreferences;
    }
    get buildData() {
        return this.buildConfigData ?? buildConfig;
    }
    get registryData() {
        return this.registryConfigData;
    }

    // convenience getters

    get version() {
        return this.combinedData?.version ?? defaultPreferences.version;
    }
    get darkMode() {
        return this.combinedData?.darkMode ?? defaultPreferences.darkMode;
    }
    get localServers() {
        return this.localConfigData?.teams ?? defaultPreferences.teams;
    }
    get predefinedServers() {
        return this._predefinedServers;
    }
    get enableHardwareAcceleration() {
        return this.combinedData?.enableHardwareAcceleration ?? defaultPreferences.enableHardwareAcceleration;
    }

    get startInFullscreen() {
        return this.combinedData?.startInFullscreen ?? defaultPreferences.startInFullscreen;
    }
    get enableServerManagement() {
        return this.combinedData?.enableServerManagement ?? buildConfig.enableServerManagement;
    }
    get enableAutoUpdater() {
        return this.combinedData?.enableAutoUpdater ?? buildConfig.enableAutoUpdater;
    }
    get autostart() {
        return this.combinedData?.autostart ?? defaultPreferences.autostart;
    }
    get hideOnStart() {
        return this.combinedData?.hideOnStart ?? defaultPreferences.hideOnStart;
    }
    get notifications() {
        return this.combinedData?.notifications ?? defaultPreferences.notifications;
    }
    get showUnreadBadge() {
        return this.combinedData?.showUnreadBadge ?? defaultPreferences.showUnreadBadge;
    }
    get useSpellChecker() {
        return this.combinedData?.useSpellChecker ?? defaultPreferences.useSpellChecker;
    }

    get spellCheckerURL(): (string|undefined) {
        return this.combinedData?.spellCheckerURL;
    }

    get spellCheckerLocales() {
        return this.combinedData?.spellCheckerLocales ?? defaultPreferences.spellCheckerLocales;
    }
    get showTrayIcon() {
        return this.combinedData?.showTrayIcon ?? defaultPreferences.showTrayIcon;
    }
    get trayIconTheme() {
        return this.combinedData?.trayIconTheme ?? defaultPreferences.trayIconTheme;
    }
    get downloadLocation() {
        return this.combinedData?.downloadLocation ?? getDefaultDownloadLocation();
    }
    get helpLink() {
        return this.combinedData?.helpLink;
    }
    get academyLink() {
        return this.combinedData?.academyLink;
    }
    get upgradeLink() {
        return this.combinedData?.upgradeLink;
    }
    get minimizeToTray() {
        return this.combinedData?.minimizeToTray;
    }
    get lastActiveServer() {
        return this.combinedData?.lastActiveTeam;
    }
    get alwaysClose() {
        return this.combinedData?.alwaysClose;
    }
    get alwaysMinimize() {
        return this.combinedData?.alwaysMinimize;
    }

    get canUpgrade() {
        return process.env.NODE_ENV === 'test' || (this.canUpgradeValue && this.buildConfigData?.enableAutoUpdater && !(process.platform === 'linux' && !process.env.APPIMAGE) && !(process.platform === 'win32' && this.registryConfigData?.enableAutoUpdater === false));
    }

    get autoCheckForUpdates() {
        return this.combinedData?.autoCheckForUpdates;
    }

    get appLanguage() {
        return this.combinedData?.appLanguage;
    }

    get enableMetrics() {
        return this.combinedData?.enableMetrics;
    }

    /**
     * Gets the servers from registry into the config object and reload
     *
     * @param {object} registryData Server configuration from the registry and if servers can be managed by user
     */

    private onLoadRegistry = (registryData: Partial<RegistryConfigType>): void => {
        log.debug('loadRegistry', {registryData});

        this.registryConfigData = registryData;
        if (this.registryConfigData.servers) {
            this._predefinedServers.push(...this.registryConfigData.servers.map((server, index) => getDefaultViewsForConfigServer({...server, order: index})));
        }
        this.reload();
    };

    /**
     * Config file loading methods
     */

    /**
     * Used to save the current set of local config data to disk
     *
     * @emits {update} emitted once all data has been saved
     * @emits {synchronize} emitted once all data has been saved; used to notify other config instances of changes
     * @emits {error} emitted if saving local config data to file fails
     */
    private saveLocalConfigData = (): void => {
        if (!(this.configFilePath && this.localConfigData)) {
            return;
        }

        log.verbose('Saving config data to file...');

        try {
            this.writeFile(this.configFilePath, this.localConfigData, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    if (error.code === 'EBUSY') {
                        this.saveLocalConfigData();
                    } else {
                        this.emit('error', error);
                    }
                }
                this.emit('update', this.combinedData);
            });
        } catch (error) {
            this.emit('error', error);
        }
    };

    /**
     * Loads and returns locally stored config data from the filesystem or returns app defaults if no file is found
     */
    private loadLocalConfigFile = (): AnyConfig => {
        if (!this.configFilePath) {
            throw new Error('Unable to read from config, no path specified');
        }

        let configData: AnyConfig;
        try {
            configData = JSON.parse(fs.readFileSync(this.configFilePath, 'utf8'));

            // validate based on config file version
            configData = Validator.validateConfigData(configData);

            if (!configData) {
                throw new Error('Provided configuration file does not validate, using defaults instead.');
            }
        } catch (e) {
            log.warn('Failed to load configuration file from the filesystem. Using defaults.');
            configData = copy(this.defaultConfigData);

            this.writeFile(this.configFilePath, configData);
        }
        return configData;
    };

    /**
     * Determines if locally stored data needs to be updated and upgrades as needed
     *
     * @param {*} data locally stored data
     */
    private checkForConfigUpdates = (data: AnyConfig) => {
        if (!this.configFilePath) {
            throw new Error('Config not initialized');
        }

        let configData = data;
        if (this.defaultConfigData) {
            try {
                if (configData.version !== this.defaultConfigData.version) {
                    configData = upgradeConfigData(configData);
                    this.writeFile(this.configFilePath, configData);
                    log.info(`Configuration updated to version ${this.defaultConfigData.version} successfully.`);
                }
                const didMigrate = migrateConfigItems(configData);
                if (didMigrate) {
                    this.writeFile(this.configFilePath, configData);
                    log.info('Migrating config items successfully.');
                }
            } catch (error) {
                log.error(`Failed to update configuration to version ${this.defaultConfigData.version}.`);
            }
        }

        return configData as ConfigType;
    };

    /**
     * Properly combines all sources of data into a single, manageable set of all config data
     */
    private regenerateCombinedConfigData = () => {
        if (!this.appName) {
            throw new Error('Config not initialized, cannot regenerate');
        }

        // combine all config data in the correct order
        this.combinedData = Object.assign({},
            this.defaultConfigData,
            this.localConfigData,
            this.buildConfigData,
            this.registryConfigData,
        );

        // We don't want to include the servers in the combined config, they should only be accesible via the ServerManager
        delete (this.combinedData as any).teams;
        delete (this.combinedData as any).servers;
        delete (this.combinedData as any).defaultServers;

        if (this.combinedData) {
            this.combinedData.appName = this.appName;
        }
    };

    // helper functions
    private writeFile = (filePath: string, configData: Partial<ConfigType>, callback?: fs.NoParamCallback) => {
        if (!this.defaultConfigData) {
            return;
        }

        if (configData.version !== this.defaultConfigData.version) {
            throw new Error('version ' + configData.version + ' is not equal to ' + this.defaultConfigData.version);
        }
        const json = JSON.stringify(configData, null, '  ');

        if (callback) {
            fs.writeFile(filePath, json, 'utf8', callback);
        } else {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }

            fs.writeFileSync(filePath, json, 'utf8');
        }
    };

    private checkWriteableApp = () => {
        if (!this.appPath) {
            throw new Error('Config not initialized, cannot regenerate');
        }

        if (process.platform === 'win32') {
            try {
                fs.accessSync(path.join(path.dirname(this.appPath), '../../'), fs.constants.W_OK);

                // check to make sure that app-update.yml exists
                if (!fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) {
                    log.warn('app-update.yml does not exist, disabling auto-updates');
                    return false;
                }
            } catch (error) {
                log.info(`${this.appPath}: ${error}`);
                log.warn('autoupgrade disabled');
                return false;
            }

            // eslint-disable-next-line no-undef
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return __CAN_UPGRADE__; // prevent showing the option if the path is not writeable, like in a managed environment.
        }

        // temporarily disabling auto updater for macOS due to security issues
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return process.platform !== 'darwin' && __CAN_UPGRADE__;
    };
}

const config = new Config();
export default config;
