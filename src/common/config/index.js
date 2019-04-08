// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';
import path from 'path';

import {EventEmitter} from 'events';

import {app} from 'electron';

import defaultPreferences from './defaultPreferences';
import upgradeConfigData from './upgradePreferences';
import buildConfig from './buildConfig';

const configFilePath = app.getPath('userData') + '/config.json';

export default class Config extends EventEmitter {
  constructor() {
    super();
    this.reload();
  }

  reload() {
    this.defaultConfigData = this.loadDefaultConfigData();
    this.buildConfigData = this.loadBuildConfigData();

    this.localConfigData = this.loadConfigFile();
    this.localConfigData = this.checkForConfigUpdates(this.localConfigData);

    this.GPOConfigData = this.loadGPOConfigData();

    this.regenerateCombinedConfigData();

    this.emit('update', this.combinedData);
  }

  set(key, data) {
    let newData = data;

    // pre-process data as needed before saving
    switch (key) {
    case 'teams':
      newData = this.filterOutDuplicateTeams(newData);

      // remove teams already defined in buildConfig or GPOConfig
      newData = this.filterOutPredefinedTeams(newData);
      break;
    }

    this.localConfigData[key] = newData;
    try {
      this.writeFileSync(configFilePath, this.localConfigData);
      this.regenerateCombinedConfigData();

      this.emit('update', this.combinedData);
    } catch (error) {
      this.emit('error', error);
    }
  }

  replace(data) {
    const newData = data;

    // remove teams already defined in buildConfig or GPOConfig
    newData.teams = this.filterOutPredefinedTeams(newData.teams);

    this.localConfigData = Object.assign({}, this.localConfigData, newData);
    try {
      this.writeFileSync(configFilePath, this.localConfigData);
      this.regenerateCombinedConfigData();

      this.emit('update', this.combinedData);
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
  get GPOData() {
    return this.GPOConfigData;
  }

  // convenience getters

  get teams() {
    return this.combinedData.teams;
  }
  get localTeams() {
    return this.localConfigData.teams;
  }
  get predefinedTeams() {
    return [...this.buildConfigData.defaultTeams, ...this.GPOConfigData.teams];
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

  loadDefaultConfigData() {
    return this.deepCopy(defaultPreferences);
  }

  loadBuildConfigData() {
    return this.deepCopy(buildConfig);
  }

  loadConfigFile() {
    let configData = {};
    try {
      configData = this.readFileSync(configFilePath);
    } catch (e) {
      console.log('Failed to load configuration file from the filesystem. Using defaults.');
      configData = this.copy(this.defaultConfigData);

      // add default team to teams if one exists and there arent currently any teams
      if (!configData.teams.length && this.defaultConfigData.defaultTeam) {
        configData.teams.push(this.defaultConfigData.defaultTeam);
      }
      delete configData.defaultTeam;

      this.writeFileSync(configFilePath, configData);
    }
    return configData;
  }

  checkForConfigUpdates(data) {
    let configData = data;
    try {
      if (configData.version !== this.defaultConfigData.version) {
        configData = upgradeConfigData(configData);
        this.writeFileSync(configFilePath, configData);
        console.log(`Configuration updated to version ${this.defaultConfigData.version} successfully.`);
      }
    } catch (error) {
      console.log(`Failed to update configuration to version ${this.defaultConfigData.version}.`);
    }
    return configData;
  }

  loadGPOConfigData() {
    const configData = {
      teams: [],
      enableServerManagement: true,
    };
    if (process.platform === 'win32') {
      // load GPO data here
    }
    return configData;
  }

  regenerateCombinedConfigData() {
    // combine all config data in the correct order
    this.combinedData = Object.assign({}, this.defaultConfigData, this.localConfigData, this.buildConfigData, this.GPOConfigData);

    // remove unecessary data from default and build config
    delete this.combinedData.defaultTeam;
    delete this.combinedData.defaultTeams;

    // IMPORTANT: properly combine teams from all sources
    const combinedTeams = [];

    // - start by adding default teams from buildConfig, if any
    if (this.buildConfigData.defaultTeams && this.buildConfigData.defaultTeams.length) {
      combinedTeams.push(...this.deepCopy(this.buildConfigData.defaultTeams));
    }

    // - add GPO defined teams, if any
    if (this.GPOConfigData.teams && this.GPOConfigData.teams.length) {
      combinedTeams.push(...this.GPOConfigData.teams);
    }

    // - add locally defined teams only if server management is enabled
    if (this.enableServerManagement) {
      combinedTeams.push(...this.localConfigData.teams);
    }

    this.combinedData.teams = combinedTeams;
    this.combinedData.localTeams = this.localConfigData.teams;
    this.combinedData.buildTeams = this.buildConfigData.defaultTeams;
    this.combinedData.GPOTeams = this.GPOConfigData.teams;
  }

  filterOutDuplicateTeams(teams) {
    let newTeams = teams;
    const uniqueURLs = new Set();
    newTeams = newTeams.filter((team) => {
      return uniqueURLs.has(team.url) ? false : uniqueURLs.add(team.url);
    });
    return newTeams;
  }

  filterOutPredefinedTeams(teams) {
    let newTeams = teams;

    // filter out predefined teams
    newTeams = newTeams.filter((newTeam) => {
      return this.predefinedTeams.findIndex((existingTeam) => newTeam.url === existingTeam.url) === -1; // eslint-disable-line max-nested-callbacks
    });

    return newTeams;
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

  deepCopy(data) {
    return JSON.parse(JSON.stringify(data));
  }
}
