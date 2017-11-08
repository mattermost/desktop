const settings = require('../../src/common/settings');
const buildConfig = require('../../src/common/config/buildConfig');
const defaultPreferences = require('../../src/common/config/defaultPreferences');
const pastDefaultPreferences = require('../../src/common/config/pastDefaultPreferences');

describe('common/settings.js', () => {
  it('should upgrade v0 config file', () => {
    const v0Config = {
      url: 'https://example.com/team'
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
        url: 'https://example.com'
      }
    ];

    const mergedTeams = settings.mergeDefaultTeams(teams);
    mergedTeams.should.deep.equal([
      {
        name: 'test',
        url: 'https://example.com'
      },
      ...buildConfig.defaultTeams
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
