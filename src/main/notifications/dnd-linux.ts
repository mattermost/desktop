// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'child_process';

import log from 'electron-log';

const GNOME_READ_DND = 'gsettings get org.gnome.desktop.notifications show-banners';

function getLinuxDoNotDisturb() {
    try {
        const showNotifications = execSync(GNOME_READ_DND).toString().replace('\n', '');
        log.debug('getLinuxDoNotDisturb', {showNotifications});

        return showNotifications !== 'true';
    } catch (error) {
        log.error('getLinuxDoNotDisturb Error:', {error});

        return false;
    }
}

export default getLinuxDoNotDisturb;
