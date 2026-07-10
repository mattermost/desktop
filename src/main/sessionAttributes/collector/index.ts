// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MacSessionAttributeCollector} from './macSessionAttributeCollector';
import {SessionAttributeCollector} from './sessionAttributeCollector';

function createSessionAttributeCollector(): SessionAttributeCollector {
    switch (process.platform) {
    case 'darwin':
        return new MacSessionAttributeCollector();
    default:
        return new SessionAttributeCollector();
    }
}

const sessionAttributeCollector = createSessionAttributeCollector();
export default sessionAttributeCollector;
