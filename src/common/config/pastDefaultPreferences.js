import defaultPreferences from './defaultPreferences';

const pastDefaultPreferences = {
  0: {
    url: '',
  },
};

pastDefaultPreferences[`${defaultPreferences.version}`] = defaultPreferences;

export default pastDefaultPreferences;
