// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import events from 'events';
import {ipcMain} from 'electron';

import {UPDATE_MENTIONS, UPDATE_TRAY, UPDATE_BADGE, SESSION_EXPIRED} from 'common/communication';

import * as WindowManager from './windows/windowManager';

const status = {
    unreads: new Map(),
    mentions: new Map(),
    expired: new Map(),
    emitter: new events.EventEmitter(),
};

const emitMentions = (serverName) => {
    const newMentions = getMentions(serverName);
    const newUnreads = getUnreads(serverName);
    const isExpired = getIsExpired(serverName);

    WindowManager.sendToRenderer(UPDATE_MENTIONS, serverName, newMentions, newUnreads, isExpired);
    emitStatus();
};

const emitTray = (expired, mentions, unreads) => {
    status.emitter.emit(UPDATE_TRAY, expired, Boolean(mentions), unreads);
};

const emitBadge = (expired, mentions, unreads) => {
    status.emitter.emit(UPDATE_BADGE, expired, mentions, unreads);
};

const emitStatus = () => {
    const expired = anyExpired();
    const mentions = totalMentions();
    const unreads = anyUnreads();
    emitTray(expired, mentions, unreads);
    emitBadge(expired, mentions, unreads);
};

export const updateMentions = (serverName, mentions, unreads) => {
    if (typeof unreads !== 'undefined') {
        status.unreads.set(serverName, Boolean(unreads));
    }
    status.mentions.set(serverName, mentions || 0);
    emitMentions(serverName);
};

export const updateUnreads = (serverName, unreads) => {
    status.unreads.set(serverName, Boolean(unreads));
    emitMentions(serverName);
};

export const getUnreads = (serverName) => {
    return status.unreads.get(serverName) || false;
};

export const getMentions = (serverName) => {
    return status.mentions.get(serverName) || 0; // this might be undefined as a way to tell that we don't know as it might need to login still.
};

export const getIsExpired = (serverName) => {
    return status.expired.get(serverName) || false;
};

export const anyMentions = () => {
    for (const v of status.mentions.values()) {
        if (v > 0) {
            return v;
        }
    }
    return false;
};

export const totalMentions = () => {
    let total = 0;
    for (const v of status.mentions.values()) {
        total += v;
    }
    return total;
};

export const anyUnreads = () => {
    for (const v of status.unreads.values()) {
        if (v) {
            return v;
        }
    }
    return false;
};

export const anyExpired = () => {
    for (const v of status.expired.values()) {
        if (v) {
            return v;
        }
    }
    return false;
};

// add any other event emitter methods if needed
export const on = (event, listener) => {
    status.emitter.on(event, listener);
};

export const setSessionExpired = (serverName, expired) => {
    const isExpired = Boolean(expired);
    const old = status.expired.get(serverName);
    status.expired.set(serverName, isExpired);
    if (typeof old !== 'undefined' && old !== isExpired) {
        emitTray();
    }
    emitMentions(serverName);
};

ipcMain.on(SESSION_EXPIRED, (event, isExpired, serverName) => {
    setSessionExpired(serverName, isExpired);
});
