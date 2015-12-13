const should = require('should');
const fs = require('fs');
const settings = require('../src/common/settings');

const config_file_path = '../test_config.json'

describe('settings.js', function() {

  it('should upgrade v0 config file', function() {
    const v0_config = {
      url: 'http://example.com/team'
    };
    config = settings.upgrade(v0_config);
    config.url.length.should.equal(1);
    config.url[0].should.equal(v0_config.url);
    config.version.should.equal(settings.version);
  });
});
