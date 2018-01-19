const fs = require('fs');

class JsonFileManager {
  constructor(file) {
    this.jsonFile = file;
    try {
      this.json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
      this.json = {};
    }
  }

  writeToFile() {
    fs.writeFile(this.jsonFile, JSON.stringify(this.json, null, 2), (err) => {
      if (err) {
        console.error(err);
      }
    });
  }

  setJson(json) {
    this.json = json;
    this.writeToFile();
  }

  setValue(key, value) {
    this.json[key] = value;
    this.writeToFile();
  }

  getValue(key) {
    return this.json[key];
  }
}

module.exports = JsonFileManager;
