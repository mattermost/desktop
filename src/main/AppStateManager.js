import JsonFileManager from '../common/JsonFileManager';

export default class AppStateManager extends JsonFileManager {
  set lastAppVersion(version) {
    this.setValue('lastAppVersion', version);
  }

  get lastAppVersion() {
    return this.getValue('lastAppVersion');
  }
}
