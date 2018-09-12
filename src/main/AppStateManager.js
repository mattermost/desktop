// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import JsonFileManager from '../common/JsonFileManager';

export default class AppStateManager extends JsonFileManager {
  set lastAppVersion(version) {
    this.setValue('lastAppVersion', version);
  }

  get lastAppVersion() {
    return this.getValue('lastAppVersion');
  }
}
