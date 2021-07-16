// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import events from 'events';
import {ipcMain} from 'electron';

import {UPDATE_MENTIONS, UPDATE_TRAY, UPDATE_BADGE, SESSION_EXPIRED, UPDATE_DROPDOWN_MENTIONS} from 'common/communication';

import * as WindowManager from './windows/windowManager';

const status = {
    unreads: new Map<string, boolean>(),
    mentions: new Map<string, number>(),
    expired: new Map<string, boolean>(),
    emitter: new events.EventEmitter(),
};

const emitMentions = (serverName: string) => {
    const newMentions = getMentions(serverName);
    const newUnreads = getUnreads(serverName);
    const isExpired = getIsExpired(serverName);

    WindowManager.sendToRenderer(UPDATE_MENTIONS, serverName, newMentions, newUnreads, isExpired);
    emitStatus();
};

const emitTray = (expired?: boolean, mentions?: number, unreads?: boolean) => {
    status.emitter.emit(UPDATE_TRAY, expired, Boolean(mentions), unreads);
};

const emitBadge = (expired?: boolean, mentions?: number, unreads?: boolean) => {
    status.emitter.emit(UPDATE_BADGE, expired, mentions, unreads);
};

const emitDropdown = (expired?: Map<string, boolean>, mentions?: Map<string, number>, unreads?: Map<string, boolean>) => {
    status.emitter.emit(UPDATE_DROPDOWN_MENTIONS, expired, mentions, unreads);
};

export const emitStatus = () => {
    const expired = anyExpired();
    const mentions = totalMentions();
    const unreads = anyUnreads();
    emitTray(expired, mentions, unreads);
    emitBadge(expired, mentions, unreads);
    emitDropdown(status.expired, status.mentions, status.unreads);
};

export const updateMentions = (serverName: string, mentions: number, unreads?: boolean) => {
    if (typeof unreads !== 'undefined') {
        status.unreads.set(serverName, Boolean(unreads));
    }
    status.mentions.set(serverName, mentions || 0);
    emitMentions(serverName);
};

export const updateUnreads = (serverName: string, unreads: boolean) => {
    status.unreads.set(serverName, Boolean(unreads));
    emitMentions(serverName);
};

export const updateBadge = () => {
    const expired = anyExpired();
    const mentions = totalMentions();
    const unreads = anyUnreads();
    emitBadge(expired, mentions, unreads);
};

export const getUnreads = (serverName: string) => {
    return status.unreads.get(serverName) || false;
};

export const getMentions = (serverName: string) => {
    return status.mentions.get(serverName) || 0; // this might be undefined as a way to tell that we don't know as it might need to login still.
};

export const getIsExpired = (serverName: string) => {
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
export const on = (event: string, listener: (...args: any[]) => void) => {
    status.emitter.on(event, listener);
};

export const setSessionExpired = (serverName: string, expired: boolean) => {
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
