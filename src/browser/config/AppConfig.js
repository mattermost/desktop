import {remote} from 'electron';

import settings from '../../common/settings';

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

export default new AppConfig(remote.app.getPath('userData') + '/config.json');
