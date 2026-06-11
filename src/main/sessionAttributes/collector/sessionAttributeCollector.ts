// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import ServerManager from 'common/servers/serverManager';

export class SessionAttributeCollector {
    getClientIPAddress() {
        return '';
    }

    getVPNActive() {
        return '';
    }

    getNetworkInterfaceType() {
        return '';
    }

    getSSID() {
        return '';
    }

    getHardwareId() {
        return '';
    }

    getMDMEnrolled() {
        return '';
    }

    getOSPlatform(): string {
        switch (process.platform) {
        case 'darwin':
            return 'macos';
        case 'win32':
            return 'windows';
        default:
            return process.platform;
        }
    }

    getOSVersion() {
        return process.getSystemVersion();
    }

    getClientVersion() {
        return app.getVersion();
    }

    getServerFQDN(serverId: string) {
        const server = ServerManager.getServer(serverId);
        return server?.url.hostname ?? '';
    }

    getClientFQDN() {
        return '';
    }
}
