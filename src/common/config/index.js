// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';
import path from 'path';

import {EventEmitter} from 'events';

import * as Validator from '../../main/Validator';

import defaultPreferences from './defaultPreferences';
import upgradeConfigData from './upgradePreferences';
import buildConfig from './buildConfig';

/**
 * Handles loading and merging all sources of configuration as well as saving user provided config
 */
export default class Config extends EventEmitter {
  constructor(configFilePath, registryConfigData = {teams: []}) {
    super();
    this.configFilePath = configFilePath;
    this.registryConfigData = registryConfigData;
    this.reload();
  }

  /**
   * Reload all sources of config data
   *
   * @param {boolean} synchronize determines whether or not to emit a synchronize event once config has been reloaded
   * @emits {update} emitted once all data has been loaded and merged
   * @emits {synchronize} emitted when requested by a call to method; used to notify other config instances of changes
   */
  reload(synchronize = false) {
    this.defaultConfigData = this.loadDefaultConfigData();
    this.buildConfigData = this.loadBuildConfigData();

    this.localConfigData = this.loadLocalConfigFile();
    this.localConfigData = this.checkForConfigUpdates(this.localConfigData);

    this.regenerateCombinedConfigData();

    this.emit('update', this.combinedData);

    if (synchronize) {
      this.emit('synchronize');
    }
  }

  /**
   * Used to save a single config property
   *
   * @param {string} key name of config property to be saved
   * @param {*} data value to save for provided key
   */
  set(key, data) {
    if (key) {
      this.localConfigData[key] = data;
      this.regenerateCombinedConfigData();
      this.saveLocalConfigData();
    }
  }

  /**
   * Used to save an array of config properties in one go
   *
   * @param {array} properties an array of config properties to save
   */
  setMultiple(properties = []) {
    if (properties.length) {
      properties.forEach(({key, data}) => {
        if (key) {
          this.localConfigData[key] = data;
        }
      });
      this.regenerateCombinedConfigData();
      this.saveLocalConfigData();
    }
  }

  setRegistryConfigData(registryConfigData = {teams: []}) {
    this.registryConfigData = Object.assign({}, registryConfigData);
    this.reload();
  }

  /**
   * Used to replace the existing config data with new config data
   *
   * @param {object} configData a new, config data object to completely replace the existing config data
   */
  replace(configData) {
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
  saveLocalConfigData() {
    try {
      this.writeFile(this.configFilePath, this.localConfigData, (error) => {
        if (error) {
          throw new Error(error);
        }
        this.emit('update', this.combinedData);
        this.emit('synchronize');
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
    return this.localConfigData;
  }
  get defaultData() {
    return this.defaultConfigData;
  }
  get buildData() {
    return this.buildConfigData;
  }
  get registryData() {
    return this.registryConfigData;
  }

  // convenience getters

  get version() {
    return this.combinedData.version;
  }
  get teams() {
    return this.combinedData.teams;
  }
  get darkMode() {
    return this.combinedData.darkMode;
  }
  get localTeams() {
    return this.localConfigData.teams;
  }
  get predefinedTeams() {
    return [...this.buildConfigData.defaultTeams, ...this.registryConfigData.teams];
  }
  get enableHardwareAcceleration() {
    return this.combinedData.enableHardwareAcceleration;
  }
  get enableServerManagement() {
    return this.combinedData.enableServerManagement;
  }
  get enableAutoUpdater() {
    return this.combinedData.enableAutoUpdater;
  }
  get autostart() {
    return this.combinedData.autostart;
  }
  get notifications() {
    return this.combinedData.notifications;
  }
  get showUnreadBadge() {
    return this.combinedData.showUnreadBadge;
  }
  get useSpellChecker() {
    return this.combinedData.useSpellChecker;
  }
  get spellCheckerLocale() {
    return this.combinedData.spellCheckerLocale;
  }
  get showTrayIcon() {
    return this.combinedData.showTrayIcon;
  }
  get trayIconTheme() {
    return this.combinedData.trayIconTheme;
  }
  get helpLink() {
    return this.combinedData.helpLink;
  }

  // initialization/processing methods

  /**
   * Returns a copy of the app's default config data
   */
  loadDefaultConfigData() {
    return this.copy(defaultPreferences);
  }

  /**
   * Returns a copy of the app's build config data
   */
  loadBuildConfigData() {
    return this.copy(buildConfig);
  }

  /**
   * Loads and returns locally stored config data from the filesystem or returns app defaults if no file is found
   */
  loadLocalConfigFile() {
    let configData = {};
    try {
      configData = this.readFileSync(this.configFilePath);

      // validate based on config file version
      if (configData.version > 1) {
        configData = Validator.validateV2ConfigData(configData);
      } else {
        switch (configData.version) {
        case 1:
          configData = Validator.validateV1ConfigData(configData);
          break;
        default:
          configData = Validator.validateV0ConfigData(configData);
        }
      }
      if (!configData) {
        throw new Error('Provided configuration file does not validate, using defaults instead.');
      }
    } catch (e) {
      console.log('Failed to load configuration file from the filesystem. Using defaults.');
      configData = this.copy(this.defaultConfigData);

      // add default team to teams if one exists and there arent currently any teams
      if (!configData.teams.length && this.defaultConfigData.defaultTeam) {
        configData.teams.push(this.defaultConfigData.defaultTeam);
      }
      delete configData.defaultTeam;

      this.writeFileSync(this.configFilePath, configData);
    }
    return configData;
  }

  /**
   * Determines if locally stored data needs to be updated and upgrades as needed
   *
   * @param {*} data locally stored data
   */
  checkForConfigUpdates(data) {
    let configData = data;
    try {
      if (configData.version !== this.defaultConfigData.version) {
        configData = upgradeConfigData(configData);
        this.writeFileSync(this.configFilePath, configData);
        console.log(`Configuration updated to version ${this.defaultConfigData.version} successfully.`);
      }
    } catch (error) {
      console.log(`Failed to update configuration to version ${this.defaultConfigData.version}.`);
    }
    return configData;
  }

  /**
   * Properly combines all sources of data into a single, manageable set of all config data
   */
  regenerateCombinedConfigData() {
    // combine all config data in the correct order
    this.combinedData = Object.assign({}, this.defaultConfigData, this.localConfigData, this.buildConfigData, this.registryConfigData);

    // remove unecessary data pulled from default and build config
    delete this.combinedData.defaultTeam;
    delete this.combinedData.defaultTeams;

    // IMPORTANT: properly combine teams from all sources
    let combinedTeams = [];

    // - start by adding default teams from buildConfig, if any
    if (this.buildConfigData.defaultTeams && this.buildConfigData.defaultTeams.length) {
      combinedTeams.push(...this.buildConfigData.defaultTeams);
    }

    // - add registry defined teams, if any
    if (this.registryConfigData.teams && this.registryConfigData.teams.length) {
      combinedTeams.push(...this.registryConfigData.teams);
    }

    // - add locally defined teams only if server management is enabled
    if (this.enableServerManagement) {
      combinedTeams.push(...this.localConfigData.teams);
    }

    combinedTeams = this.filterOutDuplicateTeams(combinedTeams);
    combinedTeams = this.sortUnorderedTeams(combinedTeams);

    this.combinedData.teams = combinedTeams;
    this.combinedData.localTeams = this.localConfigData.teams;
    this.combinedData.buildTeams = this.buildConfigData.defaultTeams;
    this.combinedData.registryTeams = this.registryConfigData.teams;
  }

  /**
   * Returns the provided list of teams with duplicates filtered out
   *
   * @param {array} teams array of teams to check for duplicates
   */
  filterOutDuplicateTeams(teams) {
    let newTeams = teams;
    const uniqueURLs = new Set();
    newTeams = newTeams.filter((team) => {
      return uniqueURLs.has(team.url) ? false : uniqueURLs.add(team.url);
    });
    return newTeams;
  }

  /**
   * Returns the provided array fo teams with existing teams filtered out
   * @param {array} teams array of teams to check for already defined teams
   */
  filterOutPredefinedTeams(teams) {
    let newTeams = teams;

    // filter out predefined teams
    newTeams = newTeams.filter((newTeam) => {
      return this.predefinedTeams.findIndex((existingTeam) => newTeam.url === existingTeam.url) === -1; // eslint-disable-line max-nested-callbacks
    });

    return newTeams;
  }

  /**
   * Apply a default sort order to the team list, if no order is specified.
   * @param {array} teams to sort
   */
  sortUnorderedTeams(teams) {
    // We want to preserve the array order of teams in the config, otherwise a lot of bugs will occur
    const mappedTeams = teams.map((team, index) => ({team, originalOrder: index}));

    // Make a best pass at interpreting sort order. If an order is not specified, assume it is 0.
    //
    const newTeams = mappedTeams.sort((x, y) => {
      if (x.team.order == null) {
        x.team.order = 0;
      }
      if (y.team.order == null) {
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

  readFileSync(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  writeFile(filePath, configData, callback) {
    if (configData.version !== this.defaultConfigData.version) {
      throw new Error('version ' + configData.version + ' is not equal to ' + this.defaultConfigData.version);
    }
    const json = JSON.stringify(configData, null, '  ');
    fs.writeFile(filePath, json, 'utf8', callback);
  }

  writeFileSync(filePath, config) {
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

  merge(base, target) {
    return Object.assign({}, base, target);
  }

  copy(data) {
    return Object.assign({}, data);
  }
}
