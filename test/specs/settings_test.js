// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import settings from '../../src/common/settings';
import buildConfig from '../../src/common/config/buildConfig';
import defaultPreferences from '../../src/common/config/defaultPreferences';
import pastDefaultPreferences from '../../src/common/config/pastDefaultPreferences';

describe('common/settings.js', () => {
  it('should upgrade v0 config file', () => {
    const v0Config = {
      url: 'https://example.com/team',
    };
    const config = settings.upgrade(v0Config);
    config.teams.length.should.equal(1);
    config.teams[0].url.should.equal(v0Config.url);
    config.version.should.equal(settings.version);
  });

  it('should merge teams with buildConfig.defaultTeams', () => {
    const teams = [
      {
        name: 'test',
        url: 'https://example.com',
      },
    ];

    const mergedTeams = settings.mergeDefaultTeams(teams);
    mergedTeams.should.deep.equal([
      {
        name: 'test',
        url: 'https://example.com',
      },
      ...buildConfig.defaultTeams,
    ]);
  });
});

describe('common/config/', () => {
  it('pastDefaultPreferences should have each past version of defaultPreferences', () => {
    for (let version = 0; version <= defaultPreferences.version; version++) {
      pastDefaultPreferences[`${version}`].should.exist;
    }
  });

  it('defaultPreferences equal to one of pastDefaultPreferences', () => {
    const pastPreferences = pastDefaultPreferences[`${defaultPreferences.version}`];
    pastPreferences.should.deep.equal(defaultPreferences);
  });
});
