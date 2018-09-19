// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {remote} from 'electron';

import settings from '../../common/settings';
import SpellChecker from '../../main/SpellChecker';

class AppConfig {
  constructor(file) {
    this.fileName = file;
    try {
      this.data = settings.readFileSync(file, remote.app.getName());
    } catch (e) {
      const spellCheckerLocale = SpellChecker.getSpellCheckerLocale(remote.app.getLocale());
      this.data = settings.loadDefault(spellCheckerLocale, remote.app.getName());
    }
  }

  set(key, value) {
    this.data[key] = value;
    settings.writeFileSync(this.fileName, this.data);
  }
}

export default new AppConfig(remote.app.getPath('userData') + '/config.json');
