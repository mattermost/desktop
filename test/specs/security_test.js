'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const env = require('../modules/environment');

describe('application', function() {
  this.timeout(10000);

  const serverPort = 8181;
  const testURL = `http://localhost:${serverPort}`

  const config = {
    version: 1,
    teams: [{
      name: 'example_1',
      url: testURL
    }, {
      name: 'example_2',
      url: testURL
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
    env.addClientCommands(this.app.client);
    return this.app.client
      .getAttribute('webview', 'nodeintegration').then((nodeintegration) => {
        // nodeintegration is an array of string
        nodeintegration.forEach((n) => {
          n.should.equal('false');
        });
      })
      // webview is handled as a window by chromedriver.
      .windowByIndex(1).isNodeEnabled().should.eventually.be.false
      .windowByIndex(2).isNodeEnabled().should.eventually.be.false;
  });

  it('should NOT be able to call Node.js API in a new window', function() {
    env.addClientCommands(this.app.client);
    const client = this.app.client;
    return this.app.client
      .windowByIndex(1) // in the first webview
      .execute(function() {
        open_window();
      })
      .waitUntil(function async() {
        return client.windowHandles().then((handles) => {
          return handles.value.length === 4;
        });
      }, 5000, 'expected a new window')
      .windowByIndex(3).isNodeEnabled().should.eventually.be.false;
  })
});
