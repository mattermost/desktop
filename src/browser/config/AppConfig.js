const settings = require('../../common/settings');
const {remote} = require('electron');
const SpellChecker = require('../../main/SpellChecker');

class AppConfig {
  constructor(file) {
    this.fileName = file;
    try {
      this.data = settings.readFileSync(file);
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

module.exports = new AppConfig(remote.app.getPath('userData') + '/config.json');
