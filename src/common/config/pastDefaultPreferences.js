const defaultPreferences = require('./defaultPreferences');

const pastDefaultPreferences = {
  0: {
    url: ''
  }
};

pastDefaultPreferences[`${defaultPreferences.version}`] = defaultPreferences;

module.exports = pastDefaultPreferences;
