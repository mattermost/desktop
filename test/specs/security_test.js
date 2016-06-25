'use strict';

const path = require('path');
const fs = require('fs');

const env = require('../modules/environment');

describe('application', function() {
  const config = {
    version: 1,
    teams: [{
      name: 'example_1',
      url: env.mattermostURL
    }, {
      name: 'example_2',
      url: env.mattermostURL
    }]
  };

  beforeEach(function() {
    fs.writeFileSync(env.configFilePath, JSON.stringify(config));
    this.app = env.getSpectronApp();
    return this.app.start();
  });

  afterEach(function() {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  });

  it('should NOT be able to call Node.js API in webview', function() {
    return this.app.client
      // Ideally, need to confirm actual behavior in webview by executing require('electron');
      .getAttribute('webview', 'nodeintegration').then((nodeintegration) => {
        // nodeintegration is an array of string
        nodeintegration.forEach((n) => {
          n.should.equal('false');
        });
      });
  });
});
