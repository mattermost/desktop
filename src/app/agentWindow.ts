// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, ipcMain, screen} from 'electron';
import type {IpcMainEvent} from 'electron';

import {
    HIDE_AGENT_WINDOW,
    AGENT_WINDOW_SUBMIT,
    AGENT_WINDOW_SHOWN,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import AgentService from 'main/server/agentService';
import {getLocalPreload} from 'main/utils';

const log = new Logger('AgentWindow');

const AGENT_WINDOW_WIDTH = 600;
const AGENT_WINDOW_HEIGHT = 72;

export class AgentWindow {
    private win?: BrowserWindow;

    constructor() {
        ipcMain.on(HIDE_AGENT_WINDOW, this.hide);
        ipcMain.on(AGENT_WINDOW_SUBMIT, this.handleSubmit);
    }

    init = () => {
        if (this.win) {
            return;
        }

        this.win = new BrowserWindow({
            width: AGENT_WINDOW_WIDTH,
            height: AGENT_WINDOW_HEIGHT,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            show: false,
            skipTaskbar: true,
            resizable: false,
            hasShadow: true,
            backgroundColor: '#00ffffff',
            webPreferences: {
                preload: getLocalPreload('internalAPI.js'),
            },
        });

        this.win.setVisibleOnAllWorkspaces(true, {
            visibleOnFullScreen: true,
            skipTransformProcessType: true,
        });
        this.win.setAlwaysOnTop(true, 'screen-saver');

        this.win.loadURL('mattermost-desktop://renderer/agentWindow.html');

        this.win.on('blur', this.hide);

        this.win.on('close', (e) => {
            e.preventDefault();
            this.hide();
        });

        log.debug('AgentWindow initialized');
    };

    toggle = () => {
        if (!this.win) {
            return;
        }

        if (this.win.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    };

    show = () => {
        if (!this.win) {
            return;
        }

        const cursorPoint = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(cursorPoint);
        const {x, y, width, height} = display.workArea;

        const winBounds = this.win.getBounds();
        this.win.setBounds({
            x: Math.round(x + (width - winBounds.width) / 2),
            y: Math.round(y + (height * 0.3)),
            width: AGENT_WINDOW_WIDTH,
            height: AGENT_WINDOW_HEIGHT,
        });

        this.win.show();
        this.win.focus();

        this.win.webContents.send(AGENT_WINDOW_SHOWN);
    };

    hide = () => {
        if (this.win?.isVisible()) {
            this.win.hide();
        }
    };

    destroy = () => {
        if (this.win) {
            this.win.removeAllListeners('close');
            this.win.removeAllListeners('blur');
            this.win.close();
            this.win = undefined;
        }
    };

    private handleSubmit = async (_event: IpcMainEvent, text: string) => {
        const agent = Config.agent;
        if (!agent?.selectedAgentId || !agent?.selectedServerUrl) {
            log.warn('No agent selected, ignoring submit');
            return;
        }

        this.hide();

        try {
            await AgentService.sendPromptAndOpenRHS(
                agent.selectedServerUrl,
                agent.selectedAgentId,
                text,
            );
        } catch (error) {
            log.error('Failed to send agent prompt:', {error});
        }
    };
}

const agentWindow = new AgentWindow();
export default agentWindow;
