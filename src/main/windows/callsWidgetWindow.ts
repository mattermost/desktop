// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow} from 'electron';
import log from 'electron-log';

import {CallsWidgetWindowConfig} from 'types/calls';

import {getLocalPreload} from 'main/utils';

export default function createCallsWidgetWindow(mainWindow: BrowserWindow, config: CallsWidgetWindowConfig) {
    const preload = getLocalPreload('callsWidget.js');
    const win = new BrowserWindow({
        parent: mainWindow,
        width: 274,
        height: 82,
        title: 'Calls Widget', // TODO: possibly add channel name?
        fullscreen: false,
        resizable: false,
        frame: false,
        transparent: true,
        show: false,
        alwaysOnTop: true,
        webPreferences: {
            preload,

            // Workaround for this issue: https://github.com/electron/electron/issues/30993
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            transparent: true,
        }});

    win.once('ready-to-show', () => {
        win.show();
    });

    const size = win.getSize();
    const mainPos = mainWindow.getPosition();
    const mainSize = mainWindow.getSize();
    win.setPosition(mainPos[0] + 12, (mainPos[1] + mainSize[1]) - size[1] - 12);
    win.setBackgroundColor('#00ffffff');
    win.setMenuBarVisibility(false);

    win.webContents.openDevTools({mode: 'detach'});

    const pluginID = 'com.mattermost.calls';
    const widgetURL = `${config.siteURL}/static/plugins/${pluginID}/widget/widget.html?call_id=${config.channelID}`;
    win.loadURL(widgetURL).catch(
        (reason) => {
            log.error(`Calls window failed to load: ${reason}`);
        });

    return win;
}

