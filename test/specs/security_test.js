'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const env = require('../modules/environment');

describe('application', function() {
  const serverPort = 8181;

  const config = {
    version: 1,
    teams: [{
      name: 'example_1',
      url: `http://localhost:${serverPort}`
    }, {
      name: 'example_2',
      url: `http://localhost:${serverPort}`
    }]
  };

  before(function() {
    this.server = http.createServer(function(req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end(fs.readFileSync(path.resolve(env.sourceRootDir, 'test/modules/test.html'), 'utf-8'));
    }).listen(serverPort, '127.0.0.1');
  });

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

  after(function(done) {
    this.server.close(done);
  })

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

  it('should NOT be able to call Node.js API in a new window', function() {
    return this.app.client
      .execute(function() {
        const webview = document.querySelector('webview');
        webview.executeJavaScript('open_window();');
      })
      .windowByIndex(1)
      .execute(function() {
        try {
          return require('fs') ? true : false;
        }
        catch (e) {
          return false;
        }
      }).then((require_fs_result) => {
        require_fs_result.value.should.be.false;
      });
  })
});
