// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-var */

declare namespace globalThis {
    var willAppQuit: boolean;
    var isDev: boolean;
    var args: {
        hidden?: boolean;
        disableDevMode?: boolean;
        dataDir?: string;
        version?: boolean;
        fullscreen?: boolean;
    };
}
