// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DARK_MODE_CHANGE, GET_DARK_MODE} from 'common/communication';

import darkStyles from 'renderer/css/lazy/modals-dark.lazy.css';

export default function addDarkModeListener() {
    window.addEventListener('message', async (event) => {
        if (event.data.type === DARK_MODE_CHANGE) {
            if (event.data.data) {
                darkStyles.use();
            } else {
                darkStyles.unuse();
            }
        }
    });
    window.postMessage({type: GET_DARK_MODE}, window.location.href);
}
