// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const env = require('../modules/environment');

describe.skip('security', function desc() {
  this.timeout(30000);

  const serverPort = 8181;
  const testURL = `http://localhost:${serverPort}`;

  const config = {
    version: 2,
    teams: [{
      name: 'example_1',
      url: testURL,
      order: 0,
    }, {
      name: 'example_2',
      url: testURL,
      order: 1,
    }],
  };

  before(() => {
    this.server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
      });
      res.end(fs.readFileSync(path.resolve(env.sourceRootDir, 'test/modules/test.html'), 'utf-8'));
    }).listen(serverPort, '127.0.0.1');
  });

  beforeEach(() => {
    fs.writeFileSync(env.configFilePath, JSON.stringify(config));
    this.app = env.getSpectronApp();
    return this.app.start();
  });

  afterEach(() => {
    if (this.app && this.app.isRunning()) {
      return this.app.stop();
    }
    return true;
  });

  after((done) => {
    this.server.close(done);
  });

  it('should NOT be able to call Node.js API in webview', () => {
    env.addClientCommands(this.app.client);

    // webview is handled as a window by chromedriver.
    return this.app.client.
      windowByIndex(1).isNodeEnabled().then((enabled) => {
        enabled.should.be.false;
      }).
      windowByIndex(2).isNodeEnabled().then((enabled) => {
        enabled.should.be.false;
      }).
      windowByIndex(0).
      getAttribute('webview', 'nodeintegration').then((nodeintegration) => {
        // nodeintegration is an array of string
        nodeintegration.forEach((n) => {
          n.should.equal('false');
        });
      });
  });

  it('should NOT be able to call Node.js API in a new window', () => {
    env.addClientCommands(this.app.client);
    const client = this.app.client;
    return this.app.client.
      windowByIndex(1). // in the first webview
      execute(() => {
        open_window();
      }).
      waitUntil(() => {
        return client.windowHandles().then((handles) => {
          return handles.value.length === 4;
        });
      }, 5000, 'expected a new window').
      windowByIndex(3).isNodeEnabled().then((enabled) => {
        enabled.should.be.false;
      });
  });

  it('should NOT be able to call eval() in any window', () => {
    env.addClientCommands(this.app.client);
    const tryEval = (index) => {
      return this.app.client.
        windowByIndex(index).
        execute(() => {
          return eval('1 + 1');
        }).then((result) => {
          throw new Error(`Promise was unexpectedly fulfilled (result: ${result})`);
        }, (error) => {
          (error !== null).should.be.true;
        });
    };
    const tryEvalInSettingsPage = () => {
      return this.app.client.
        windowByIndex(0).
        loadSettingsPage().
        execute(() => {
          return eval('1 + 1');
        }).then((result) => {
          throw new Error(`Promise was unexpectedly fulfilled (result: ${result})`);
        }, (error) => {
          (error !== null).should.be.true;
        });
    };
    return Promise.all([
      tryEval(0),
      tryEvalInSettingsPage(),
    ]);
  });
});
