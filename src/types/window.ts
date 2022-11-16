// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CookiesSetDetails, ipcRenderer} from 'electron/renderer';

import {RendererAPI} from './rendererAPI';

declare global {
    interface Window {
        ipcRenderer: {
            send: typeof ipcRenderer.send;
            on: (channel: string, listener: (...args: any[]) => void) => void;
            invoke: typeof ipcRenderer.invoke;
        };
        process: {
            platform: NodeJS.Platform;
            env: {
                user?: string;
                username?: string;
            };
        };
        timers: {
            setImmediate: typeof setImmediate;
        };
        mas: {
            getThumbnailLocation: (location: string) => Promise<string>;
        };
        desktop: {
            getAPI: () => Promise<RendererAPI | undefined>;
        };
        mattermost: {
            getUrl: Promise<string>;
            setupCookies: Promise<CookiesSetDetails[]>;
            setCookie: (cookie: string) => Promise<void>;
        };
    }
}
