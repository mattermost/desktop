const JsonFileManager = require('../common/JsonFileManager');

class AppStateManager extends JsonFileManager {
  set lastAppVersion(version) {
    this.setValue('lastAppVersion', version);
  }

  get lastAppVersion() {
    return this.getValue('lastAppVersion');
  }
}

module.exports = AppStateManager;
