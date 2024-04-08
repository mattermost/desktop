// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';

import {UPDATE_APPSTATE, UPDATE_APPSTATE_TOTALS, UPDATE_APPSTATE_FOR_VIEW_ID} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';

const log = new Logger('AppState');

export class AppState extends EventEmitter {
    private expired: Map<string, boolean>;
    private mentions: Map<string, number>;
    private unreads: Map<string, boolean>;

    constructor() {
        super();

        this.expired = new Map();
        this.mentions = new Map();
        this.unreads = new Map();
    }

    updateExpired = (viewId: string, expired: boolean) => {
        ServerManager.getViewLog(viewId, 'AppState').silly('updateExpired', expired);

        this.expired.set(viewId, expired);
        this.emitStatusForView(viewId);
    };

    updateMentions = (viewId: string, mentions: number) => {
        ServerManager.getViewLog(viewId, 'AppState').silly('updateMentions', mentions);

        this.mentions.set(viewId, mentions);
        this.emitStatusForView(viewId);
    };

    updateUnreads = (viewId: string, unreads: boolean) => {
        ServerManager.getViewLog(viewId, 'AppState').silly('updateUnreads', unreads);

        this.unreads.set(viewId, unreads);
        this.emitStatusForView(viewId);
    };

    clear = (viewId: string) => {
        ServerManager.getViewLog(viewId, 'AppState').silly('clear');

        this.expired.delete(viewId);
        this.mentions.delete(viewId);
        this.unreads.delete(viewId);

        this.emitStatusForView(viewId);
    };

    emitStatus = () => {
        log.silly('emitStatus');

        this.emit(UPDATE_APPSTATE,
            this.expired,
            this.mentions,
            this.unreads,
        );
        this.emit(UPDATE_APPSTATE_TOTALS,
            [...this.expired.values()].some((value) => value),
            [...this.mentions.values()].reduce((total, value) => total + value, 0),
            [...this.unreads.values()].some((value) => value),
        );
    };

    private emitStatusForView = (viewId: string) => {
        this.emit(UPDATE_APPSTATE_FOR_VIEW_ID,
            viewId,
            this.expired.get(viewId) || false,
            this.mentions.get(viewId) || 0,
            this.unreads.get(viewId) || false,
        );

        this.emitStatus();
    };
}

const appState = new AppState();
export default appState;
