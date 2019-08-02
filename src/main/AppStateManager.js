// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import JsonFileManager from '../common/JsonFileManager';

import * as Validator from './Validator';

export default class AppStateManager extends JsonFileManager {
  constructor(file) {
    super(file);

    // ensure data loaded from file is valid
    const validatedJSON = Validator.validateAppState(this.json);
    if (!validatedJSON) {
      this.setJson({});
    }
  }

  set lastAppVersion(version) {
    this.setValue('lastAppVersion', version);
  }

  get lastAppVersion() {
    return this.getValue('lastAppVersion');
  }
}
