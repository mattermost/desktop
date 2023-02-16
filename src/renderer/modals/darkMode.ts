// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import darkStyles from 'renderer/css/lazy/modals-dark.lazy.css';

export default function addDarkModeListener() {
    const setDarkMode = (darkMode: boolean) => {
        if (darkMode) {
            darkStyles.use();
        } else {
            darkStyles.unuse();
        }
    };
    window.desktop.onDarkModeChange(setDarkMode);
    window.desktop.getDarkMode().then(setDarkMode);
}
