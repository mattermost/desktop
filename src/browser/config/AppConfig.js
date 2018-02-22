const {remote} = require('electron');

const settings = require('../../common/settings');

class AppConfig {
  constructor(file) {
    this.fileName = file;
    try {
      this.data = settings.readFileSync(file);
    } catch (e) {
      this.data = {
        teams: [],
      };
    }
  }

  set(key, value) {
    this.data[key] = value;
    settings.writeFileSync(this.fileName, this.data);
  }
}

module.exports = new AppConfig(remote.app.getPath('userData') + '/config.json');
