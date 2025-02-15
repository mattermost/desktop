// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export default function addDarkModeListener() {
    const setDarkMode = (darkMode: boolean) => {
        if (darkMode) {
            document.body.classList.add('darkMode');
        } else {
            document.body.classList.remove('darkMode');
        }
    };
    window.desktop.onDarkModeChange(setDarkMode);
    window.desktop.getDarkMode().then(setDarkMode);
}
