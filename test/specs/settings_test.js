const fs = require('fs');
const settings = require('../../src/common/settings');

const env = require('../modules/environment');
//const env.configFilePath = '../../test_config.json'

describe('common/settings.js', function() {

  it('should upgrade v0 config file', function() {
    const v0_config = {
      url: 'https://example.com/team'
    };
    config = settings.upgrade(v0_config);
    config.teams.length.should.equal(1);
    config.teams[0].url.should.equal(v0_config.url);
    config.version.should.equal(settings.version);
  });
});
