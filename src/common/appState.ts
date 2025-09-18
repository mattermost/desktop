// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';

import {
    UPDATE_APPSTATE,
    UPDATE_APPSTATE_TOTALS,
    UPDATE_APPSTATE_FOR_VIEW_ID,
    SERVER_LOGGED_IN_CHANGED,
    UPDATE_APPSTATE_FOR_SERVER_ID,
} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import ViewManager from 'common/views/viewManager';

const log = new Logger('AppState');

export class AppState extends EventEmitter {
    private expired: Map<string, boolean>;
    private mentions: Map<string, number>;
    private unreads: Map<string, boolean>;

    private mentionsPerServer: Map<string, number>;
    private unreadsPerServer: Map<string, boolean>;

    constructor() {
        super();

        this.expired = new Map();
        this.mentions = new Map();
        this.unreads = new Map();

        this.mentionsPerServer = new Map();
        this.unreadsPerServer = new Map();

        ServerManager.on(SERVER_LOGGED_IN_CHANGED, this.handleServerLoggedInChanged);
    }

    private handleServerLoggedInChanged = (serverId: string, loggedIn: boolean) => {
        if (!loggedIn) {
            this.clearServer(serverId);
        }
    };

    getExpired = () => {
        return this.expired;
    };

    getMentionsPerServer = () => {
        return this.mentionsPerServer;
    };

    getUnreadsPerServer = () => {
        return this.unreadsPerServer;
    };

    updateExpired = (serverId: string, expired: boolean) => {
        ServerManager.getServerLog(serverId, 'AppState').silly('updateExpired', expired);

        this.expired.set(serverId, expired);
        this.emitStatusForServer(serverId);
    };

    updateMentions = (viewId: string, mentions: number) => {
        ViewManager.getViewLog(viewId, 'AppState').silly('updateMentions', mentions);

        this.mentions.set(viewId, mentions);
        this.reduceNotificationsPerServer(this.mentionsPerServer, this.mentions, (base, value) => (base ?? 0) + (value ?? 0));
        this.emitStatusForView(viewId);
    };

    updateUnreads = (viewId: string, unreads: boolean) => {
        ViewManager.getViewLog(viewId, 'AppState').silly('updateUnreads', unreads);

        this.unreads.set(viewId, unreads);
        this.reduceNotificationsPerServer(this.unreadsPerServer, this.unreads, (base, value) => base || value || false);
        this.emitStatusForView(viewId);
    };

    updateMentionsPerServer = (serverId: string, mentions: number) => {
        ViewManager.getViewLog(serverId, 'AppState').silly('updateMentionsPerServer', mentions);
        this.mentionsPerServer.set(serverId, mentions);
        this.emitStatusForServer(serverId);
    };

    updateUnreadsPerServer = (serverId: string, unreads: boolean) => {
        ViewManager.getViewLog(serverId, 'AppState').silly('updateUnreadsPerServer', unreads);
        this.unreadsPerServer.set(serverId, unreads);
        this.emitStatusForServer(serverId);
    };

    clear = (viewId: string) => {
        ViewManager.getViewLog(viewId, 'AppState').silly('clear');

        this.expired.delete(viewId);
        this.mentions.delete(viewId);
        this.unreads.delete(viewId);

        this.emitStatusForView(viewId);
    };

    clearServer = (serverId: string) => {
        ServerManager.getServerLog(serverId, 'AppState').silly('clearServer');

        this.mentionsPerServer.delete(serverId);
        this.unreadsPerServer.delete(serverId);

        for (const view of ViewManager.getViewsByServerId(serverId)) {
            this.clear(view.id);
        }
    };

    emitStatus = () => {
        log.silly('emitStatus');

        this.emit(UPDATE_APPSTATE);
        this.emit(UPDATE_APPSTATE_TOTALS,
            [...this.expired.values()].some((value) => value),
            [...this.mentions.values(), ...this.mentionsPerServer.values()].reduce((total, value) => total + value, 0),
            [...this.unreads.values(), ...this.unreadsPerServer.values()].some((value) => value),
        );
    };

    private emitStatusForView = (viewId: string) => {
        const view = ViewManager.getView(viewId);
        if (!view) {
            log.warn('emitStatusForView: view not found', {viewId});
            this.emitStatus();
            return;
        }

        this.emit(UPDATE_APPSTATE_FOR_VIEW_ID,
            viewId,
            this.expired.get(view.serverId) || false,
            this.mentions.get(viewId) || 0,
            this.unreads.get(viewId) || false,
        );
        this.emitStatusForServer(view.serverId);
    };

    private emitStatusForServer = (serverId: string) => {
        this.emit(UPDATE_APPSTATE_FOR_SERVER_ID,
            serverId,
            this.expired.get(serverId) || false,
            this.mentionsPerServer.get(serverId) || 0,
            this.unreadsPerServer.get(serverId) || false,
        );

        this.emitStatus();
    };

    private reduceNotificationsPerServer = <T>(inputMap: Map<string, T>, items: Map<string, T>, modifier: (base?: T, value?: T) => T) => {
        inputMap.clear();
        return [...items.keys()].reduce((map, key) => {
            const view = ViewManager.getView(key);
            if (!view) {
                return map;
            }
            const server = ServerManager.getServer(view.serverId);
            if (!server) {
                return map;
            }
            map.set(server.id, modifier(map.get(server.id), items.get(key)));
            return map;
        }, inputMap);
    };
}

const appState = new AppState();
export default appState;
