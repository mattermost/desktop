const settings = require('../../src/common/settings');
const deepmerge = require('deepmerge');

describe('common/settings.js', () => {
  before(() => {
    process.env.TEST = 1;
  });

  after(() => {
    delete process.env.TEST;
  });

  it('should upgrade v0 config file', () => {
    const v0Config = {
      url: 'https://example.com/team'
    };
    const config = settings.upgrade(v0Config);
    config.teams.length.should.equal(1);
    config.teams[0].url.should.equal(v0Config.url);
    config.version.should.equal(settings.version);
  });

  it('should loadDefault config for version 1', () => {
    const baseConfig = require('../../src/common/config/base.json');
    const overrideConfig = require('../../src/common/config/override.json');
    const expectedDefaults = deepmerge(
      baseConfig[1], overrideConfig[1] || {}, {clone: true, arrayMerge: settings.deepMergeArray}
    );
    const defaultConfig = settings.loadDefault();
    defaultConfig.should.eql(expectedDefaults);
  });
});
