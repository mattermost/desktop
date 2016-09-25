const settings = require('../../src/common/settings');

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
});
