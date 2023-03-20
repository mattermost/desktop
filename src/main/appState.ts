// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import events from 'events';
import {ipcMain} from 'electron';

import log from 'electron-log';

import {UPDATE_MENTIONS, UPDATE_TRAY, UPDATE_BADGE, SESSION_EXPIRED, UPDATE_DROPDOWN_MENTIONS} from 'common/communication';

import WindowManager from './windows/windowManager';

const status = {
    unreads: new Map<string, boolean>(),
    mentions: new Map<string, number>(),
    expired: new Map<string, boolean>(),
    emitter: new events.EventEmitter(),
};

const emitMentions = (viewId: string) => {
    const newMentions = getMentions(viewId);
    const newUnreads = getUnreads(viewId);
    const isExpired = getIsExpired(viewId);

    WindowManager.sendToRenderer(UPDATE_MENTIONS, viewId, newMentions, newUnreads, isExpired);
    log.silly('AppState.emitMentions', {viewId, isExpired, newMentions, newUnreads});
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

const emitStatus = () => {
    const expired = anyExpired();
    const mentions = totalMentions();
    const unreads = anyUnreads();
    emitTray(expired, mentions, unreads);
    emitBadge(expired, mentions, unreads);
    emitDropdown(status.expired, status.mentions, status.unreads);
};

export const updateMentions = (viewId: string, mentions: number, unreads?: boolean) => {
    if (typeof unreads !== 'undefined') {
        status.unreads.set(viewId, Boolean(unreads));
    }
    status.mentions.set(viewId, mentions || 0);
    emitMentions(viewId);
};

export const updateUnreads = (viewId: string, unreads: boolean) => {
    status.unreads.set(viewId, Boolean(unreads));
    emitMentions(viewId);
};

export const updateBadge = () => {
    const expired = anyExpired();
    const mentions = totalMentions();
    const unreads = anyUnreads();
    emitBadge(expired, mentions, unreads);
};

const getUnreads = (viewId: string) => {
    return status.unreads.get(viewId) || false;
};

const getMentions = (viewId: string) => {
    return status.mentions.get(viewId) || 0; // this might be undefined as a way to tell that we don't know as it might need to login still.
};

const getIsExpired = (viewId: string) => {
    return status.expired.get(viewId) || false;
};

const totalMentions = () => {
    let total = 0;
    for (const v of status.mentions.values()) {
        total += v;
    }
    return total;
};

const anyUnreads = () => {
    for (const v of status.unreads.values()) {
        if (v) {
            return v;
        }
    }
    return false;
};

const anyExpired = () => {
    for (const v of status.expired.values()) {
        if (v) {
            return v;
        }
    }
    return false;
};

// add any other event emitter methods if needed
export const on = status.emitter.on.bind(status.emitter);

const setSessionExpired = (viewId: string, expired: boolean) => {
    const isExpired = Boolean(expired);
    const old = status.expired.get(viewId);
    status.expired.set(viewId, isExpired);
    if (typeof old !== 'undefined' && old !== isExpired) {
        emitTray();
    }
    emitMentions(viewId);
};

ipcMain.on(SESSION_EXPIRED, (event, isExpired, viewId) => {
    if (isExpired) {
        log.debug('SESSION_EXPIRED', {isExpired, viewId});
    }
    setSessionExpired(viewId, isExpired);
});
