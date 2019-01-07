// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import defaultPreferences from './defaultPreferences';

const pastDefaultPreferences = {
  0: {
    url: '',
  },
  1: {
    teams: [],
  },
};

pastDefaultPreferences[`${defaultPreferences.version}`] = defaultPreferences;

export default pastDefaultPreferences;
