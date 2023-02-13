// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    GET_LANGUAGE_INFORMATION,
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
    UPDATE_URL_VIEW_WIDTH,
    DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE,
    DOWNLOADS_DROPDOWN_MENU_SHOW_FILE_IN_FOLDER,
    DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD,
    DOWNLOADS_DROPDOWN_MENU_OPEN_FILE,
    UPDATE_DOWNLOADS_DROPDOWN_MENU,
    REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO,
    UPDATE_TEAMS_DROPDOWN,
    REQUEST_TEAMS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
    SWITCH_SERVER,
    SHOW_NEW_SERVER_MODAL,
    SHOW_EDIT_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    RECEIVE_DOWNLOADS_DROPDOWN_SIZE,
    REQUEST_CLEAR_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    START_UPDATE_DOWNLOAD,
    START_UPGRADE,
    TOGGLE_DOWNLOADS_DROPDOWN_MENU,
    GET_DOWNLOADED_IMAGE_THUMBNAIL_LOCATION,
    DOWNLOADS_DROPDOWN_OPEN_FILE,
    MODAL_CANCEL,
    MODAL_RESULT,
    RETRIEVE_MODAL_INFO,
    GET_MODAL_UNCLOSEABLE,
    PING_DOMAIN,
    LOADING_SCREEN_ANIMATION_FINISHED,
    TOGGLE_LOADING_SCREEN_VISIBILITY,
    DOWNLOADS_DROPDOWN_FOCUSED,
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

contextBridge.exposeInMainWorld('mas', {
    getThumbnailLocation: (location) => ipcRenderer.invoke(GET_DOWNLOADED_IMAGE_THUMBNAIL_LOCATION, location),
});

contextBridge.exposeInMainWorld('desktop', {
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
    getLanguageInformation: () => ipcRenderer.invoke(GET_LANGUAGE_INFORMATION),

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
    onUpdateDownloadsDropdown: (listener) => ipcRenderer.on(UPDATE_DOWNLOADS_DROPDOWN, (_, downloads, darkMode, windowBounds, item) => listener(downloads, darkMode, windowBounds, item)),
    onAppMenuWillClose: (listener) => ipcRenderer.on(APP_MENU_WILL_CLOSE, () => listener()),
    onFocusThreeDotMenu: (listener) => ipcRenderer.on(FOCUS_THREE_DOT_MENU, () => listener()),
    updateURLViewWidth: (width) => ipcRenderer.send(UPDATE_URL_VIEW_WIDTH, width),

    downloadsDropdown: {
        toggleDownloadsDropdownMenu: (payload) => ipcRenderer.send(TOGGLE_DOWNLOADS_DROPDOWN_MENU, payload),
        requestInfo: () => ipcRenderer.send(REQUEST_DOWNLOADS_DROPDOWN_INFO),
        sendSize: (width, height) => ipcRenderer.send(RECEIVE_DOWNLOADS_DROPDOWN_SIZE, width, height),
        requestClearDownloadsDropdown: () => ipcRenderer.send(REQUEST_CLEAR_DOWNLOADS_DROPDOWN),
        openFile: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_OPEN_FILE, item),
        startUpdateDownload: () => ipcRenderer.send(START_UPDATE_DOWNLOAD),
        startUpgrade: () => ipcRenderer.send(START_UPGRADE),
        focus: () => ipcRenderer.send(DOWNLOADS_DROPDOWN_FOCUSED),
    },

    downloadsDropdownMenu: {
        requestInfo: () => ipcRenderer.send(REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO),
        showInFolder: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_SHOW_FILE_IN_FOLDER, item),
        cancelDownload: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD, item),
        clearFile: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE, item),
        openFile: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_OPEN_FILE, item),

        onUpdateDownloadsDropdownMenu: (listener) => ipcRenderer.on(UPDATE_DOWNLOADS_DROPDOWN_MENU, (_, item, darkMode) => listener(item, darkMode)),
    },

    serverDropdown: {
        requestInfo: () => ipcRenderer.send(REQUEST_TEAMS_DROPDOWN_INFO),
        sendSize: (width, height) => ipcRenderer.send(RECEIVE_DROPDOWN_MENU_SIZE, width, height),
        switchServer: (server) => ipcRenderer.send(SWITCH_SERVER, server),
        showNewServerModal: () => ipcRenderer.send(SHOW_NEW_SERVER_MODAL),
        showEditServerModal: (serverName) => ipcRenderer.send(SHOW_EDIT_SERVER_MODAL, serverName),
        showRemoveServerModal: (serverName) => ipcRenderer.send(SHOW_REMOVE_SERVER_MODAL, serverName),

        onUpdateServerDropdown: (listener) => ipcRenderer.on(UPDATE_TEAMS_DROPDOWN, (_,
            teams,
            activeTeam,
            darkMode,
            enableServerManagement,
            hasGPOTeams,
            expired,
            mentions,
            unreads,
            windowBounds,
        ) => listener(
            teams,
            activeTeam,
            darkMode,
            enableServerManagement,
            hasGPOTeams,
            expired,
            mentions,
            unreads,
            windowBounds,
        )),
    },

    loadingScreen: {
        loadingScreenAnimationFinished: () => ipcRenderer.send(LOADING_SCREEN_ANIMATION_FINISHED),
        onToggleLoadingScreenVisibility: (listener) => ipcRenderer.on(TOGGLE_LOADING_SCREEN_VISIBILITY, (_, toggle) => listener(toggle)),
    },

    modals: {
        cancelModal: (data) => ipcRenderer.send(MODAL_CANCEL, data),
        finishModal: (data) => ipcRenderer.send(MODAL_RESULT, data),
        getModalInfo: () => ipcRenderer.invoke(RETRIEVE_MODAL_INFO),
        isModalUncloseable: () => ipcRenderer.invoke(GET_MODAL_UNCLOSEABLE),
        confirmProtocol: (protocol, url) => ipcRenderer.send('confirm-protocol', protocol, url),
        pingDomain: (url) => ipcRenderer.invoke(PING_DOMAIN, url),
    },
});

// TODO: This is for modals only, should probably move this out for them
const createKeyDownListener = () => {
    ipcRenderer.invoke(GET_MODAL_UNCLOSEABLE).then((uncloseable) => {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !uncloseable) {
                ipcRenderer.send(MODAL_CANCEL);
            }
        });
    });
};
createKeyDownListener();
