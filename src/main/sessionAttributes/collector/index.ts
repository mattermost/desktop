// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SessionAttributeCollector} from './sessionAttributeCollector';

function createSessionAttributeCollector(): SessionAttributeCollector {
    // TODO: Implement platform-specific session attribute collectors
    return new SessionAttributeCollector();
}

const sessionAttributeCollector = createSessionAttributeCollector();
export default sessionAttributeCollector;
