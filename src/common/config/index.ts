// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';

import JsonFileManager from 'common/JsonFileManager';
import {Logger} from 'common/log';
import {copy} from 'common/utils/util';
import * as Validator from 'common/Validator';

import type {
    AnyConfig,
    BuildConfig,
    CombinedConfig,
    ConfigServer,
    CurrentConfig,
    RegistryConfig as RegistryCurrentConfig,
} from 'types/config';

import buildConfig from './buildConfig';
import defaultPreferences, {getDefaultDownloadLocation} from './defaultPreferences';
import migrateConfigItems from './migrationPreferences';
import policyConfigLoader from './policyConfigLoader';
import upgradeConfigData from './upgradePreferences';

const log = new Logger('Config');

export class Config extends EventEmitter {
    private configFilePath?: string;
    private appName?: string;

    private _predefinedServers: ConfigServer[];
    private json?: JsonFileManager<CurrentConfig>;

    private combinedData?: CombinedConfig;
    private localConfigData?: CurrentConfig;
    private policyConfigData?: Partial<RegistryCurrentConfig>;
    private defaultConfigData?: CurrentConfig;
    private buildConfigData?: BuildConfig;

    constructor() {
        super();
        this._predefinedServers = [];
        if (buildConfig.defaultServers) {
            this._predefinedServers.push(...buildConfig.defaultServers.map((server, index) => ({...server, order: index, isPredefined: true})));
        }
    }

    init = (configFilePath: string, appName: string) => {
        this.configFilePath = configFilePath;
        this.appName = appName;

        this.reload();
        if (process.platform === 'win32' || process.platform === 'darwin') {
            this.onLoadRegistry(policyConfigLoader.getPolicyConfig());
        }
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
    set = (key: keyof CurrentConfig, data: CurrentConfig[keyof CurrentConfig]): void => {
        log.debug('set');
        this.setMultiple({[key]: data});
    };

    setConfigPath = (configPath: string) => {
        this.configFilePath = configPath;
        this.json = undefined;
    };

    /**
     * Used to save an array of config properties in one go
     *
     * @param {array} properties an array of config properties to save
     */
    setMultiple = (newData: Partial<CurrentConfig>) => {
        log.debug('setMultiple');

        if (newData.darkMode && newData.darkMode !== this.darkMode) {
            this.emit('darkModeChange', newData.darkMode);
        }
        this.localConfigData = Object.assign({}, this.localConfigData, {...newData, servers: this.localConfigData?.servers});
        this.regenerateCombinedConfigData();
        this.saveLocalConfigData();
    };

    setServers = (servers: ConfigServer[], lastActiveServer?: number) => {
        log.debug('setServers');

        this.localConfigData = Object.assign({}, this.localConfigData, {
            servers,
            lastActiveServer: lastActiveServer ?? this.localConfigData?.lastActiveServer,
            viewLimit: this.localConfigData?.viewLimit ? Math.max(this.localConfigData.viewLimit, servers.length) : undefined,
        });
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
        return this.policyConfigData;
    }

    // convenience getters

    get version() {
        return this.combinedData?.version ?? defaultPreferences.version;
    }
    get darkMode() {
        return this.combinedData?.darkMode ?? defaultPreferences.darkMode;
    }
    get localServers() {
        return this.localConfigData?.servers ?? defaultPreferences.servers;
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
    get enableUpdateNotifications() {
        return this.combinedData?.enableUpdateNotifications ?? buildConfig.enableUpdateNotifications;
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
        return this.combinedData?.lastActiveServer;
    }
    get alwaysClose() {
        return this.combinedData?.alwaysClose;
    }
    get alwaysMinimize() {
        return this.combinedData?.alwaysMinimize;
    }

    get canUpgrade() {
        return process.env.NODE_ENV === 'test' || (this.buildConfigData?.enableUpdateNotifications && !(this.policyConfigData && this.policyConfigData?.enableUpdateNotifications === false));
    }

    get autoCheckForUpdates() {
        return this.combinedData?.autoCheckForUpdates;
    }

    get appLanguage() {
        return this.combinedData?.appLanguage;
    }

    get enableMetrics() {
        return this.combinedData?.enableMetrics ?? true;
    }

    get enableSentry() {
        return this.combinedData?.enableSentry ?? true;
    }

    get viewLimit() {
        return this.combinedData?.viewLimit ?? 15;
    }

    get themeSyncing() {
        return this.combinedData?.themeSyncing ?? true;
    }

    get useNativeTitleBar() {
        return this.combinedData?.useNativeTitleBar ?? false;
    }

    getWindowsSystemDarkMode = () => {
        return !policyConfigLoader.getAppsUseLightTheme();
    };

    /**
     * Gets the servers from registry into the config object and reload
     *
     * @param {object} registryData Server configuration from the registry and if servers can be managed by user
     */

    private onLoadRegistry = (registryData: Partial<RegistryCurrentConfig>): void => {
        log.debug('loadRegistry');

        this.policyConfigData = registryData;
        if (this.policyConfigData.servers) {
            this._predefinedServers.push(...this.policyConfigData.servers.map((server, index) => ({...server, order: index, isPredefined: true})));
        }

        this.regenerateCombinedConfigData();
        this.emit('update', this.combinedData);
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
    private saveLocalConfigData = (isRetry = false): void => {
        if (!(this.json && this.localConfigData)) {
            return;
        }

        if (!this.defaultConfigData) {
            return;
        }

        if (this.localConfigData.version !== this.defaultConfigData.version) {
            this.emit('error', new Error('version ' + this.localConfigData.version + ' is not equal to ' + this.defaultConfigData.version));
            return;
        }

        log.verbose('Saving config data to file...');

        this.json.setJson(this.localConfigData).then(() => {
            this.emit('update', this.combinedData);
        }).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'EBUSY' && !isRetry) {
                this.saveLocalConfigData(true);
            } else {
                this.emit('error', error);
            }
        });
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
            this.json = new JsonFileManager<CurrentConfig>(this.configFilePath);

            // validate based on config file version
            configData = Validator.validateConfigData(this.json.json);

            if (!configData) {
                throw new Error('Provided configuration file does not validate, using defaults instead.');
            }
        } catch (e) {
            log.warn('Failed to load configuration file from the filesystem. Using defaults.');
            configData = copy(this.defaultConfigData);

            this.json?.setJson(configData as CurrentConfig).catch((error) => {
                this.emit('error', error);
            });
        }
        return configData;
    };

    /**
     * Determines if locally stored data needs to be updated and upgrades as needed
     *
     * @param {*} data locally stored data
     */
    private checkForConfigUpdates = (data: AnyConfig): CurrentConfig => {
        if (!this.json) {
            throw new Error('Config not initialized');
        }

        let configData = data;
        if (this.defaultConfigData) {
            try {
                if (configData.version !== this.defaultConfigData.version) {
                    configData = upgradeConfigData(configData);
                    this.json.setJson(configData as CurrentConfig).catch((error) => {
                        this.emit('error', error);
                    });
                    log.info(`Configuration updated to version ${this.defaultConfigData.version} successfully.`);
                }
                const didMigrate = migrateConfigItems(configData);
                if (didMigrate) {
                    this.json.setJson(configData as CurrentConfig).catch((error) => {
                        this.emit('error', error);
                    });
                    log.info('Migrating config items successfully.');
                }
            } catch (error) {
                log.error(`Failed to update configuration to version ${this.defaultConfigData.version}.`);
            }
        }

        return configData as CurrentConfig;
    };

    /**
     * Combines all config sources into one. Order (later overrides earlier):
     * default < local < build < registry (GPO) < mdm (CFPrefs).
     * Policy keys are loaded by policyConfigLoader.
     */
    private regenerateCombinedConfigData = () => {
        if (!this.appName) {
            throw new Error('Config not initialized, cannot regenerate');
        }

        this.combinedData = Object.assign({},
            this.defaultConfigData,
            this.localConfigData,
            this.buildConfigData,
            this.policyConfigData,
        );

        // We don't want to include the servers in the combined config, they should only be accesible via the ServerManager
        delete (this.combinedData as any).servers;
        delete (this.combinedData as any).defaultServers;

        if (this.combinedData) {
            this.combinedData.appName = this.appName;
        }
    };
}

const config = new Config();
export default config;
