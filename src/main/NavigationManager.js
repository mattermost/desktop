const {app, dialog} = require('electron');
const fetch = require('electron-fetch').default;
const utils = require('../common/utils');

const endpoint = '/api/v4';

function getServerConfig(serverOrigin) {
  const url = serverOrigin + endpoint + '/config/client?format=old';
  return fetch(url).
    then((res) => {
      if (!res.ok) {
        throw new Error(`GET ${url} returned ${res.statusText}`);
      }
      return res.text();
    }).
    then((text) => {
      if (text === 'limit exceeded') {
        throw new Error(`GET ${url} limit exceeded`);
      }
      return JSON.parse(text);
    });
}

function getTrustedOrigins(serverOrigin) {
  return getServerConfig(serverOrigin).then((config) => {
    const origins = [];
    for (const key in config) {
      if (config[key].AuthEndpoint) {
        origins.push(utils.getOrigin(config[key].AuthEndpoint));
      }
      if (config[key].TokenEndpoint) {
        origins.push(utils.getOrigin(config[key].TokenEndpoint));
      }
      if (config[key].UserApiEndpoint) {
        origins.push(utils.getOrigin(config[key].UserApiEndpoint));
      }
    }
    return origins;
  });
}

function getXVersionId(responseHeaders) {
  const possibleKeys = ['X-Version-Id', 'x-version-id', 'X-VERSION-ID', 'X-Version-ID'];
  for (const key of possibleKeys) {
    if (responseHeaders[key]) {
      return responseHeaders[key][0];
    }
  }
  return null;
}

class NavigationManager {
  constructor() {
    this.allowedOrigin = [];
    this.parentWindow = null;
    this.servers = {}; // key: server origin
  }

  setWindowToPrompt(win) {
    this.parentWindow = win;
  }

  allowOrigin(origin) {
    if (this.allowedOrigin.indexOf(origin) === -1) {
      this.allowedOrigin.push(origin);
    }
  }

  isAllowed(origin) {
    if (this.servers[origin]) {
      return true;
    }
    for (const server in this.servers) {
      if (this.servers[server].trustedOrigins.includes(origin)) {
        return true;
      }
    }
    return false;
  }

  onWillNavigate(event, url) {
    const origin = utils.getOrigin(url);
    if (this.isAllowed(origin)) {
      return;
    }
    const Yes = 'Yes';
    const No = 'No';
    const buttons = [No, Yes];
    const result = dialog.showMessageBox(this.parentWindow, {
      type: 'warning',
      title: `${app.getName()}`,
      message: `The application is navigating to "${origin}". Do you want to continue?`,
      buttons,
      defaultId: buttons.indexOf(No),
      cancelId: buttons.indexOf(No)
    });
    if (result === buttons.indexOf(Yes)) {
      this.allowedOrigin.push(origin);
    } else {
      event.preventDefault();
    }
  }

  onHeadersReceived(details, callback) {
    const xVersionId = getXVersionId(details.responseHeaders);
    if (xVersionId) {
      const origin = utils.getOrigin(details.url);
      if (!this.servers[origin]) {
        this.servers[origin] = {
          xVersionId: '',
          trustedOrigins: []
        };
      }
      if (this.servers[origin].xVersionId !== xVersionId) {
        console.log(`X-Version-Id has been changed on ${origin}`);
        this.servers[origin].xVersionId = xVersionId;
        getTrustedOrigins(origin).then((origins) => {
          this.servers[origin].trustedOrigins = origins;
          console.log(`Updated trusted origins for ${origin}`);
          console.log(origins);
        }).catch((err) => {
          console.log('Error on retrieving server config');
          console.log(err);
        });
      }
    }
    callback({cancel: false});
  }
}

module.exports = NavigationManager;
