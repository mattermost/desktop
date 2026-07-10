// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MacSessionAttributeCollector} from './macSessionAttributeCollector';
import {SessionAttributeCollector} from './sessionAttributeCollector';
import {WindowsSessionAttributeCollector} from './windowsSessionAttributeCollector';

function createSessionAttributeCollector(): SessionAttributeCollector {
    switch (process.platform) {
    case 'darwin':
        return new MacSessionAttributeCollector();
    case 'win32':
        return new WindowsSessionAttributeCollector();
    default:
        return new SessionAttributeCollector();
    }
}

const sessionAttributeCollector = createSessionAttributeCollector();
export default sessionAttributeCollector;
