// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    GET_DESKTOP_APP_API,
    GET_LANGUAGE_INFORMATION,
    RETRIEVED_LANGUAGE_INFORMATION,
    QUIT,
    GET_VIEW_NAME,
    GET_VIEW_WEBCONTENTS_ID,
    OPEN_APP_MENU,
    CLOSE_TEAMS_DROPDOWN,
    OPEN_TEAMS_DROPDOWN,
    SWITCH_TAB,
    CLOSE_TAB,
    WINDOW_CLOSE,
    WINDOW_MINIMIZE,
    WINDOW_MAXIMIZE,
    WINDOW_RESTORE,
    DOUBLE_CLICK_ON_WINDOW,
    FOCUS_BROWSERVIEW,
    RELOAD_CURRENT_VIEW,
    CLOSE_DOWNLOADS_DROPDOWN,
    CLOSE_DOWNLOADS_DROPDOWN_MENU,
    OPEN_DOWNLOADS_DROPDOWN,
    HISTORY,
    CHECK_FOR_UPDATES,
    UPDATE_CONFIGURATION,
    UPDATE_TEAMS,
    GET_CONFIGURATION,
    GET_DARK_MODE,
    REQUEST_HAS_DOWNLOADS,
    GET_FULL_SCREEN_STATUS,
    GET_AVAILABLE_SPELL_CHECKER_LANGUAGES,
    GET_AVAILABLE_LANGUAGES,
    GET_LOCAL_CONFIGURATION,
    GET_DOWNLOAD_LOCATION,
    RELOAD_CONFIGURATION,
    DARK_MODE_CHANGE,
    LOAD_RETRY,
    LOAD_SUCCESS,
    LOAD_FAILED,
    SET_ACTIVE_VIEW,
    MAXIMIZE_CHANGE,
    PLAY_SOUND,
    MODAL_OPEN,
    MODAL_CLOSE,
    TOGGLE_BACK_BUTTON,
    UPDATE_MENTIONS,
    SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE,
    HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE,
    UPDATE_DOWNLOADS_DROPDOWN,
    APP_MENU_WILL_CLOSE,
    FOCUS_THREE_DOT_MENU,
    GET_CURRENT_SERVER_URL,
    SETUP_INITIAL_COOKIES,
    SET_COOKIE,
} from 'common/communication';

console.log('Preload initialized');

if (process.env.NODE_ENV === 'test') {
    contextBridge.exposeInMainWorld('testHelper', {
        getViewName: () => ipcRenderer.invoke(GET_VIEW_NAME),
        getWebContentsId: () => ipcRenderer.invoke(GET_VIEW_WEBCONTENTS_ID),
    });
}

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
    env: {
        user: process.env.USER,
        username: process.env.USERNAME,
    },
});

contextBridge.exposeInMainWorld('timers', {
    setImmediate,
});

contextBridge.exposeInMainWorld('desktop', {
    getAPI: async () => {
        const isFirst = await ipcRenderer.invoke(GET_DESKTOP_APP_API);
        if (!isFirst) {
            console.error('API already retrieved, cannot retrieve it again.');
            return undefined;
        }

        return {
            quit: (reason, stack) => ipcRenderer.send(QUIT, reason, stack),
            openAppMenu: () => ipcRenderer.send(OPEN_APP_MENU),
            closeTeamsDropdown: () => ipcRenderer.send(CLOSE_TEAMS_DROPDOWN),
            openTeamsDropdown: () => ipcRenderer.send(OPEN_TEAMS_DROPDOWN),
            switchTab: (serverName, tabName) => ipcRenderer.send(SWITCH_TAB, serverName, tabName),
            closeTab: (serverName, tabName) => ipcRenderer.send(CLOSE_TAB, serverName, tabName),
            closeWindow: () => ipcRenderer.send(WINDOW_CLOSE),
            minimizeWindow: () => ipcRenderer.send(WINDOW_MINIMIZE),
            maximizeWindow: () => ipcRenderer.send(WINDOW_MAXIMIZE),
            restoreWindow: () => ipcRenderer.send(WINDOW_RESTORE),
            doubleClickOnWindow: (windowName) => ipcRenderer.send(DOUBLE_CLICK_ON_WINDOW, windowName),
            focusBrowserView: () => ipcRenderer.send(FOCUS_BROWSERVIEW),
            reloadCurrentView: () => ipcRenderer.send(RELOAD_CURRENT_VIEW),
            closeDownloadsDropdown: () => ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN),
            closeDownloadsDropdownMenu: () => ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN_MENU),
            openDownloadsDropdown: () => ipcRenderer.send(OPEN_DOWNLOADS_DROPDOWN),
            goBack: () => ipcRenderer.send(HISTORY, -1),
            checkForUpdates: () => ipcRenderer.send(CHECK_FOR_UPDATES),
            updateConfiguration: (saveQueueItems) => ipcRenderer.send(UPDATE_CONFIGURATION, saveQueueItems),

            updateTeams: (updatedTeams) => ipcRenderer.invoke(UPDATE_TEAMS, updatedTeams),
            getConfiguration: (option) => ipcRenderer.invoke(GET_CONFIGURATION, option),
            getVersion: () => ipcRenderer.invoke('get-app-version'),
            getDarkMode: () => ipcRenderer.invoke(GET_DARK_MODE),
            requestHasDownloads: () => ipcRenderer.invoke(REQUEST_HAS_DOWNLOADS),
            getFullScreenStatus: () => ipcRenderer.invoke(GET_FULL_SCREEN_STATUS),
            getAvailableSpellCheckerLanguages: () => ipcRenderer.invoke(GET_AVAILABLE_SPELL_CHECKER_LANGUAGES),
            getAvailableLanguages: () => ipcRenderer.invoke(GET_AVAILABLE_LANGUAGES),
            getLocalConfiguration: (option) => ipcRenderer.invoke(GET_LOCAL_CONFIGURATION, option),
            getDownloadLocation: (downloadLocation) => ipcRenderer.invoke(GET_DOWNLOAD_LOCATION, downloadLocation),

            onSynchronizeConfig: (listener) => ipcRenderer.on('synchronize-config', () => listener()),
            onReloadConfiguration: (listener) => ipcRenderer.on(RELOAD_CONFIGURATION, () => listener()),
            onDarkModeChange: (listener) => ipcRenderer.on(DARK_MODE_CHANGE, (_, darkMode) => listener(darkMode)),
            onLoadRetry: (listener) => ipcRenderer.on(LOAD_RETRY, (_, viewName, retry, err, loadUrl) => listener(viewName, retry, err, loadUrl)),
            onLoadSuccess: (listener) => ipcRenderer.on(LOAD_SUCCESS, (_, viewName) => listener(viewName)),
            onLoadFailed: (listener) => ipcRenderer.on(LOAD_FAILED, (_, viewName, err, loadUrl) => listener(viewName, err, loadUrl)),
            onSetActiveView: (listener) => ipcRenderer.on(SET_ACTIVE_VIEW, (_, serverName, tabName) => listener(serverName, tabName)),
            onMaximizeChange: (listener) => ipcRenderer.on(MAXIMIZE_CHANGE, (_, maximize) => listener(maximize)),
            onEnterFullScreen: (listener) => ipcRenderer.on('enter-full-screen', () => listener()),
            onLeaveFullScreen: (listener) => ipcRenderer.on('leave-full-screen', () => listener()),
            onPlaySound: (listener) => ipcRenderer.on(PLAY_SOUND, (_, soundName) => listener(soundName)),
            onModalOpen: (listener) => ipcRenderer.on(MODAL_OPEN, () => listener()),
            onModalClose: (listener) => ipcRenderer.on(MODAL_CLOSE, () => listener()),
            onToggleBackButton: (listener) => ipcRenderer.on(TOGGLE_BACK_BUTTON, (_, showExtraBar) => listener(showExtraBar)),
            onUpdateMentions: (listener) => ipcRenderer.on(UPDATE_MENTIONS, (_event, view, mentions, unreads, isExpired) => listener(view, mentions, unreads, isExpired)),
            onCloseTeamsDropdown: (listener) => ipcRenderer.on(CLOSE_TEAMS_DROPDOWN, () => listener()),
            onOpenTeamsDropdown: (listener) => ipcRenderer.on(OPEN_TEAMS_DROPDOWN, () => listener()),
            onCloseDownloadsDropdown: (listener) => ipcRenderer.on(CLOSE_DOWNLOADS_DROPDOWN, () => listener()),
            onOpenDownloadsDropdown: (listener) => ipcRenderer.on(OPEN_DOWNLOADS_DROPDOWN, () => listener()),
            onShowDownloadsDropdownButtonBadge: (listener) => ipcRenderer.on(SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE, () => listener()),
            onHideDownloadsDropdownButtonBadge: (listener) => ipcRenderer.on(HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE, () => listener()),
            onUpdateDownloadsDropdown: (listener) => ipcRenderer.on(UPDATE_DOWNLOADS_DROPDOWN, (_, downloads) => listener(downloads)),
            onAppMenuWillClose: (listener) => ipcRenderer.on(APP_MENU_WILL_CLOSE, () => listener()),
            onFocusThreeDotMenu: (listener) => ipcRenderer.on(FOCUS_THREE_DOT_MENU, () => listener()),
        };
    },
});

contextBridge.exposeInMainWorld('mattermost', {
    getUrl: ipcRenderer.invoke(GET_CURRENT_SERVER_URL),
    setupCookies: ipcRenderer.invoke(SETUP_INITIAL_COOKIES),
    setCookie: (cookie) => ipcRenderer.send(SET_COOKIE, cookie),
});

window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case GET_LANGUAGE_INFORMATION:
        window.postMessage({type: RETRIEVED_LANGUAGE_INFORMATION, data: await ipcRenderer.invoke(GET_LANGUAGE_INFORMATION)});
        break;
    }
});
