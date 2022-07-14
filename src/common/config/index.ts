// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';

import os from 'os';
import path from 'path';

import {EventEmitter} from 'events';
import {ipcMain, nativeTheme, app} from 'electron';
import log from 'electron-log';

import {
    AnyConfig,
    BuildConfig,
    CombinedConfig,
    Config as ConfigType,
    LocalConfiguration,
    RegistryConfig as RegistryConfigType,
    TeamWithTabs,
} from 'types/config';

import {UPDATE_TEAMS, GET_CONFIGURATION, UPDATE_CONFIGURATION, GET_LOCAL_CONFIGURATION, UPDATE_PATHS} from 'common/communication';

import {configPath} from 'main/constants';
import * as Validator from 'main/Validator';
import {getDefaultTeamWithTabsFromTeam} from 'common/tabs/TabView';
import Utils from 'common/utils/util';

import defaultPreferences, {getDefaultDownloadLocation} from './defaultPreferences';
import upgradeConfigData from './upgradePreferences';
import buildConfig from './buildConfig';
import RegistryConfig, {REGISTRY_READ_EVENT} from './RegistryConfig';
import migrateConfigItems from './migrationPreferences';

/**
 * Handles loading and merging all sources of configuration as well as saving user provided config
 */

function checkWriteableApp() {
    if (process.platform === 'win32') {
        try {
            fs.accessSync(path.join(path.dirname(app.getAppPath()), '../../'), fs.constants.W_OK);

            // check to make sure that app-update.yml exists
            if (!fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) {
                log.warn('app-update.yml does not exist, disabling auto-updates');
                return false;
            }
        } catch (error) {
            log.info(`${app.getAppPath()}: ${error}`);
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
}
export class Config extends EventEmitter {
    configFilePath: string;

    registryConfig: RegistryConfig;

    combinedData?: CombinedConfig;
    registryConfigData?: Partial<RegistryConfigType>;
    defaultConfigData?: ConfigType;
    buildConfigData?: BuildConfig;
    localConfigData?: ConfigType;
    useNativeWindow: boolean;
    canUpgradeValue?: boolean

    predefinedTeams: TeamWithTabs[];

    constructor(configFilePath: string) {
        super();
        this.configFilePath = configFilePath;
        this.canUpgradeValue = checkWriteableApp();
        this.registryConfig = new RegistryConfig();
        this.predefinedTeams = [];
        if (buildConfig.defaultTeams) {
            this.predefinedTeams.push(...buildConfig.defaultTeams.map((team) => getDefaultTeamWithTabsFromTeam(team)));
        }
        try {
            this.useNativeWindow = os.platform() === 'win32' && !Utils.isVersionGreaterThanOrEqualTo(os.release(), '6.2');
        } catch {
            this.useNativeWindow = false;
        }
    }

    // separating constructor from init so main can setup event listeners
    init = (): void => {
        this.reload();
        ipcMain.handle(GET_CONFIGURATION, this.handleGetConfiguration);
        ipcMain.handle(GET_LOCAL_CONFIGURATION, this.handleGetLocalConfiguration);
        ipcMain.handle(UPDATE_TEAMS, this.handleUpdateTeams);
        ipcMain.on(UPDATE_CONFIGURATION, this.setMultiple);
        if (process.platform === 'darwin' || process.platform === 'win32') {
            nativeTheme.on('updated', this.handleUpdateTheme);
        }
        this.registryConfig = new RegistryConfig();
        this.registryConfig.once(REGISTRY_READ_EVENT, this.loadRegistry);
        this.registryConfig.init();
    }

    /**
     * Gets the teams from registry into the config object and reload
     *
     * @param {object} registryData Team configuration from the registry and if teams can be managed by user
     */

    loadRegistry = (registryData: Partial<RegistryConfigType>): void => {
        log.verbose('Config.loadRegistry', {registryData});

        this.registryConfigData = registryData;
        if (this.registryConfigData.teams) {
            this.predefinedTeams.push(...this.registryConfigData.teams.map((team) => getDefaultTeamWithTabsFromTeam(team)));
        }
        this.reload();
    }

    /**
     * Reload all sources of config data
     *
     * @param {boolean} synchronize determines whether or not to emit a synchronize event once config has been reloaded
     * @emits {update} emitted once all data has been loaded and merged
     * @emits {synchronize} emitted when requested by a call to method; used to notify other config instances of changes
     */
    reload = (): void => {
        this.defaultConfigData = this.loadDefaultConfigData();
        this.buildConfigData = this.loadBuildConfigData();
        const loadedConfig = this.loadLocalConfigFile();
        this.localConfigData = this.checkForConfigUpdates(loadedConfig);
        this.regenerateCombinedConfigData();

        this.emit('update', this.combinedData);
    }

    /**
     * Used to save a single config property
     *
     * @param {string} key name of config property to be saved
     * @param {*} data value to save for provided key
     */
    set = (key: keyof ConfigType, data: ConfigType[keyof ConfigType]): void => {
        if (key && this.localConfigData) {
            if (key === 'teams') {
                this.localConfigData.teams = this.filterOutPredefinedTeams(data as TeamWithTabs[]);
                this.predefinedTeams = this.filterInPredefinedTeams(data as TeamWithTabs[]);
            } else {
                this.localConfigData = Object.assign({}, this.localConfigData, {[key]: data});
            }
            this.regenerateCombinedConfigData();
            this.saveLocalConfigData();
        }
    }

    /**
     * Used to save an array of config properties in one go
     *
     * @param {array} properties an array of config properties to save
     */
    setMultiple = (event: Electron.IpcMainEvent, properties: Array<{key: keyof ConfigType; data: ConfigType[keyof ConfigType]}> = []): Partial<ConfigType> | undefined => {
        log.debug('Config.setMultiple', properties);

        if (properties.length) {
            this.localConfigData = Object.assign({}, this.localConfigData, ...properties.map(({key, data}) => ({[key]: data})));
            this.regenerateCombinedConfigData();
            this.saveLocalConfigData();
        }

        return this.localConfigData; //this is the only part that changes
    }

    setRegistryConfigData = (registryConfigData = {teams: []}): void => {
        this.registryConfigData = Object.assign({}, registryConfigData);
        this.reload();
    }

    /**
     * Used to replace the existing config data with new config data
     *
     * @param {object} configData a new, config data object to completely replace the existing config data
     */
    replace = (configData: ConfigType) => {
        const newConfigData = configData;

        this.localConfigData = Object.assign({}, this.localConfigData, newConfigData);

        this.regenerateCombinedConfigData();
        this.saveLocalConfigData();
    }

    /**
     * Used to save the current set of local config data to disk
     *
     * @emits {update} emitted once all data has been saved
     * @emits {synchronize} emitted once all data has been saved; used to notify other config instances of changes
     * @emits {error} emitted if saving local config data to file fails
     */
    saveLocalConfigData = (): void => {
        if (!this.localConfigData) {
            return;
        }

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
    }

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
    get teams() {
        return this.combinedData?.teams ?? defaultPreferences.teams;
    }
    get darkMode() {
        return this.combinedData?.darkMode ?? defaultPreferences.darkMode;
    }
    get localTeams() {
        return this.localConfigData?.teams ?? defaultPreferences.version;
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
    get minimizeToTray() {
        return this.combinedData?.minimizeToTray;
    }
    get lastActiveTeam() {
        return this.combinedData?.lastActiveTeam;
    }
    get alwaysClose() {
        return this.combinedData?.alwaysClose;
    }
    get alwaysMinimize() {
        return this.combinedData?.alwaysMinimize;
    }

    get canUpgrade() {
        return this.canUpgradeValue && this.buildConfigData?.enableAutoUpdater && !(process.platform === 'linux' && !process.env.APPIMAGE) && !(process.platform === 'win32' && this.registryConfigData?.enableAutoUpdater === false);
    }

    get autoCheckForUpdates() {
        return this.combinedData?.autoCheckForUpdates;
    }

    get appLanguage() {
        return this.combinedData?.appLanguage;
    }

    // initialization/processing methods

    /**
     * Returns a copy of the app's default config data
     */
    loadDefaultConfigData = () => {
        return this.copy(defaultPreferences);
    }

    /**
     * Returns a copy of the app's build config data
     */
    loadBuildConfigData = () => {
        return this.copy(buildConfig);
    }

    /**
     * Loads and returns locally stored config data from the filesystem or returns app defaults if no file is found
     */
    loadLocalConfigFile = (): AnyConfig => {
        let configData: AnyConfig;
        try {
            configData = this.readFileSync(this.configFilePath);

            // validate based on config file version
            switch (configData.version) {
            case 3:
                configData = Validator.validateV3ConfigData(configData)!;
                break;
            case 2:
                configData = Validator.validateV2ConfigData(configData)!;
                break;
            case 1:
                configData = Validator.validateV1ConfigData(configData)!;
                break;
            default:
                configData = Validator.validateV0ConfigData(configData)!;
            }
            if (!configData) {
                throw new Error('Provided configuration file does not validate, using defaults instead.');
            }
        } catch (e) {
            log.warn('Failed to load configuration file from the filesystem. Using defaults.');
            configData = this.copy(this.defaultConfigData);

            this.writeFileSync(this.configFilePath, configData);
        }
        return configData;
    }

    /**
     * Determines if locally stored data needs to be updated and upgrades as needed
     *
     * @param {*} data locally stored data
     */
    checkForConfigUpdates = (data: AnyConfig) => {
        let configData = data;
        if (this.defaultConfigData) {
            try {
                if (configData.version !== this.defaultConfigData.version) {
                    configData = upgradeConfigData(configData);
                    this.writeFileSync(this.configFilePath, configData);
                    log.info(`Configuration updated to version ${this.defaultConfigData.version} successfully.`);
                }
                const didMigrate = migrateConfigItems(configData);
                if (didMigrate) {
                    this.writeFileSync(this.configFilePath, configData);
                    log.info('Migrating config items successfully.');
                }
            } catch (error) {
                log.error(`Failed to update configuration to version ${this.defaultConfigData.version}.`);
            }
        }

        return configData as ConfigType;
    }

    /**
     * Properly combines all sources of data into a single, manageable set of all config data
     */
    regenerateCombinedConfigData = () => {
        // combine all config data in the correct order
        this.combinedData = Object.assign({}, this.defaultConfigData, this.localConfigData, this.buildConfigData, this.registryConfigData, {useNativeWindow: this.useNativeWindow});

        // remove unecessary data pulled from default and build config
        delete this.combinedData!.defaultTeams;

        // IMPORTANT: properly combine teams from all sources
        let combinedTeams: TeamWithTabs[] = [];

        combinedTeams.push(...this.predefinedTeams);

        // - add locally defined teams only if server management is enabled
        if (this.localConfigData && this.enableServerManagement) {
            combinedTeams.push(...this.localConfigData.teams || []);
        }

        this.predefinedTeams = this.filterOutDuplicateTeams(this.predefinedTeams);
        combinedTeams = this.filterOutDuplicateTeams(combinedTeams);
        combinedTeams = this.sortUnorderedTeams(combinedTeams);

        if (this.combinedData) {
            this.combinedData.teams = combinedTeams;
            this.combinedData.registryTeams = this.registryConfigData?.teams || [];
            if (process.platform === 'darwin' || process.platform === 'win32') {
                this.combinedData.darkMode = nativeTheme.shouldUseDarkColors;
            }
            this.combinedData.appName = app.name;
        }
    }

    /**
     * Returns the provided list of teams with duplicates filtered out
     *
     * @param {array} teams array of teams to check for duplicates
     */
    filterOutDuplicateTeams = (teams: TeamWithTabs[]) => {
        let newTeams = teams;
        const uniqueURLs = new Set();
        newTeams = newTeams.filter((team) => {
            return uniqueURLs.has(`${team.name}:${team.url}`) ? false : uniqueURLs.add(`${team.name}:${team.url}`);
        });
        return newTeams;
    }

    /**
     * Returns the provided array fo teams with existing teams filtered out
     * @param {array} teams array of teams to check for already defined teams
     */
    filterOutPredefinedTeams = (teams: TeamWithTabs[]) => {
        let newTeams = teams;

        // filter out predefined teams
        newTeams = newTeams.filter((newTeam) => {
            return this.predefinedTeams.findIndex((existingTeam) => newTeam.url === existingTeam.url) === -1; // eslint-disable-line max-nested-callbacks
        });

        return newTeams;
    }

    /**
     * Returns the provided array fo teams with existing teams includes
     * @param {array} teams array of teams to check for already defined teams
     */
    filterInPredefinedTeams = (teams: TeamWithTabs[]) => {
        let newTeams = teams;

        // filter out predefined teams
        newTeams = newTeams.filter((newTeam) => {
            return this.predefinedTeams.findIndex((existingTeam) => newTeam.url === existingTeam.url) >= 0; // eslint-disable-line max-nested-callbacks
        });

        return newTeams;
    }

    /**
     * Apply a default sort order to the team list, if no order is specified.
     * @param {array} teams to sort
     */
    sortUnorderedTeams = (teams: TeamWithTabs[]) => {
        // We want to preserve the array order of teams in the config, otherwise a lot of bugs will occur
        const mappedTeams = teams.map((team, index) => ({team, originalOrder: index}));

        // Make a best pass at interpreting sort order. If an order is not specified, assume it is 0.
        //
        const newTeams = mappedTeams.sort((x, y) => {
            if (!x.team.order) {
                x.team.order = 0;
            }
            if (!y.team.order) {
                y.team.order = 0;
            }

            // once we ensured `order` exists, we can sort numerically
            return x.team.order - y.team.order;
        });

        // Now re-number all items from 0 to (max), ensuring user's sort order is preserved. The
        // new tabbed interface requires an item with order:0 in order to raise the first tab.
        //
        newTeams.forEach((mappedTeam, i) => {
            mappedTeam.team.order = i;
        });

        return newTeams.sort((x, y) => x.originalOrder - y.originalOrder).map((mappedTeam) => mappedTeam.team);
    }

    // helper functions

    readFileSync = (filePath: string) => {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    writeFile = (filePath: string, configData: Partial<ConfigType>, callback: fs.NoParamCallback) => {
        if (!this.defaultConfigData) {
            return;
        }

        if (configData.version !== this.defaultConfigData.version) {
            throw new Error('version ' + configData.version + ' is not equal to ' + this.defaultConfigData.version);
        }
        const json = JSON.stringify(configData, null, '  ');
        fs.writeFile(filePath, json, 'utf8', callback);
    }

    writeFileSync = (filePath: string, config: Partial<ConfigType>) => {
        if (!this.defaultConfigData) {
            return;
        }

        if (config.version !== this.defaultConfigData.version) {
            throw new Error('version ' + config.version + ' is not equal to ' + this.defaultConfigData.version);
        }

        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        const json = JSON.stringify(config, null, '  ');
        fs.writeFileSync(filePath, json, 'utf8');
    }

    merge = <T, T2>(base: T, target: T2) => {
        return Object.assign({}, base, target);
    }

    copy = <T>(data: T) => {
        return Object.assign({}, data);
    }

    handleGetConfiguration = (event: Electron.IpcMainInvokeEvent, option: keyof CombinedConfig) => {
        log.debug('Config.handleGetConfiguration', option);

        const config = {...this.combinedData};
        if (option) {
            return config[option];
        }
        return config;
    }

    handleGetLocalConfiguration = (event: Electron.IpcMainInvokeEvent, option: keyof ConfigType) => {
        log.debug('Config.handleGetLocalConfiguration', option);

        const config: Partial<LocalConfiguration> = {...this.localConfigData};
        config.appName = app.name;
        config.enableServerManagement = this.combinedData?.enableServerManagement;
        config.canUpgrade = this.canUpgrade;
        if (option) {
            return config[option];
        }
        return config;
    }

    handleUpdateTeams = (event: Electron.IpcMainInvokeEvent, newTeams: TeamWithTabs[]) => {
        log.debug('Config.handleUpdateTeams');
        log.silly('Config.handleUpdateTeams', newTeams);

        this.set('teams', newTeams);
        return this.combinedData!.teams;
    }

    /**
     * Detects changes in darkmode if it is windows or osx, updates the config and propagates the changes
     * @emits 'darkModeChange'
     */
    handleUpdateTheme = () => {
        log.debug('Config.handleUpdateTheme');

        if (this.combinedData && this.combinedData.darkMode !== nativeTheme.shouldUseDarkColors) {
            this.combinedData.darkMode = nativeTheme.shouldUseDarkColors;
            this.emit('darkModeChange', this.combinedData.darkMode);
        }
    }

    /**
     * Manually toggles dark mode for OSes that don't have a native dark mode setting
     * @emits 'darkModeChange'
     */
    toggleDarkModeManually = () => {
        if (!this.combinedData) {
            return;
        }

        this.set('darkMode', !this.combinedData.darkMode);
        this.emit('darkModeChange', this.combinedData.darkMode);
    }
}

const config = new Config(configPath);
export default config;

ipcMain.on(UPDATE_PATHS, () => {
    log.debug('Config.UPDATE_PATHS');

    config.configFilePath = configPath;
    if (config.combinedData) {
        config.reload();
    }
});
