// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {remote} from 'electron';

import * as Validator from '../../main/Validator';
import settings from '../../common/settings';

class AppConfig {
  constructor(file) {
    this.fileName = file;
    try {
      this.data = settings.readFileSync(file);
      this.data = Validator.validateConfigData(this.data);
      if (!this.data) {
        throw new Error("Loaded 'config.json' file does not validate, using defaults instead.");
      }
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
