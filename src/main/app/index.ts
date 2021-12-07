// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {initialize} from './initialize';

if (process.env.NODE_ENV !== 'production' && module.hot) {
    module.hot.accept();
}

// attempt to initialize the application
try {
    initialize();
} catch (error) {
    throw new Error(`App initialization failed: ${error.toString()}`);
}
