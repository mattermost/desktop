// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* istanbul ignore file */

import {initialize} from './initialize';

// TODO: Singletons, we need DI :D
import('main/views/serverDropdownView');
import('main/views/downloadsDropdownMenuView');
import('main/views/downloadsDropdownView');

// attempt to initialize the application
try {
    initialize();
} catch (error: any) {
    throw new Error(`App initialization failed: ${error.toString()}`);
}
