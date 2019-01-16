// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import settings from '../../src/common/settings';
import buildConfig from '../../src/common/config/buildConfig';
import {upgradeV0toV1, upgradeV1toV2} from '../../src/common/config/upgradePreferences';
import defaultPreferences from '../../src/common/config/defaultPreferences';
import pastDefaultPreferences from '../../src/common/config/pastDefaultPreferences';

describe('common/settings.js', () => {
  it('should upgrade v0 config file to v1 config file', () => {
    const v0Config = {
      url: 'https://example.com/server',
    };
    const v1Config = upgradeV0toV1(v0Config);
    const defaultV1Config = pastDefaultPreferences['1'];

    v1Config.version.should.equal(1);
    v1Config.servers.length.should.equal(1);
    v1Config.servers[0].url.should.equal(v0Config.url);

    // Default params should be applied.
    v1Config.showTrayIcon.should.equal(defaultV1Config.showTrayIcon);
    v1Config.trayIconTheme.should.equal(defaultV1Config.trayIconTheme);
    v1Config.minimizeToTray.should.equal(defaultV1Config.minimizeToTray);
    JSON.stringify(v1Config.notifications).should.equal(JSON.stringify(defaultV1Config.notifications));
    v1Config.showUnreadBadge.should.equal(defaultV1Config.showUnreadBadge);
    v1Config.useSpellChecker.should.equal(defaultV1Config.useSpellChecker);
    v1Config.enableHardwareAcceleration.should.equal(defaultV1Config.enableHardwareAcceleration);
    v1Config.autostart.should.equal(defaultV1Config.autostart);
  });

  it('should upgrade v1 config file to v2 config file', () => {
    const v1Config = {
      version: 1,
      teams: [{
        name: 'team 1',
        url: 'https://example.com/1',
      }, {
        name: 'team 2',
        url: 'https://example.com/2',
      }],
      showTrayIcon: true,
      trayIconTheme: 'dark',
      minimizeToTray: true,
      notifications: {
        flashWindow: 1,
        bounceIcon: true,
        bounceIconType: 'critical',
      },
      showUnreadBadge: false,
      useSpellChecker: false,
      enableHardwareAcceleration: false,
      autostart: false,
    };
    const v2Config = upgradeV1toV2(v1Config);

    v2Config.version.should.equal(2);
    JSON.stringify(v2Config.servers).should.equal(JSON.stringify(v1Config.teams));

    // Other existing params should be kept.
    v2Config.showTrayIcon.should.equal(v1Config.showTrayIcon);
    v2Config.trayIconTheme.should.equal(v1Config.trayIconTheme);
    v2Config.minimizeToTray.should.equal(v1Config.minimizeToTray);
    JSON.stringify(v2Config.notifications).should.equal(JSON.stringify(v1Config.notifications));
    v2Config.showUnreadBadge.should.equal(v1Config.showUnreadBadge);
    v2Config.useSpellChecker.should.equal(v1Config.useSpellChecker);
    v2Config.enableHardwareAcceleration.should.equal(v1Config.enableHardwareAcceleration);
    v2Config.autostart.should.equal(v1Config.autostart);
  });

  it('should merge servers with buildConfig.defaultServers', () => {
    const servers = [
      {
        name: 'test',
        url: 'https://example.com',
      },
    ];

    const mergedServers = settings.mergeDefaultServers(servers);
    mergedServers.should.deep.equal([
      {
        name: 'test',
        url: 'https://example.com',
      },
      ...buildConfig.defaultServers,
    ]);
  });
});

describe('common/config/', () => {
  it('pastDefaultPreferences should have each past version of defaultPreferences', () => {
    for (let version = 0; version <= defaultPreferences.version; version++) {
      pastDefaultPreferences[`${version}`].should.exist; // eslint-disable-line no-unused-expressions
    }
  });

  it('defaultPreferences equal to one of pastDefaultPreferences', () => {
    const pastPreferences = pastDefaultPreferences[`${defaultPreferences.version}`];
    pastPreferences.should.deep.equal(defaultPreferences);
  });
});
