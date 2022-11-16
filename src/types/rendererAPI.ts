// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CombinedConfig, LocalConfiguration, Team} from './config';
import {DownloadedItems} from './downloads';
import {SaveQueueItem} from './settings';

export type RendererAPI = {
    quit: (reason: string, stack: string) => void;
    openAppMenu: () => void;
    closeTeamsDropdown: () => void;
    openTeamsDropdown: () => void;
    switchTab: (serverName: string, tabName: string) => void;
    closeTab: (serverName: string, tabName: string) => void;
    closeWindow: () => void;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    restoreWindow: () => void;
    doubleClickOnWindow: (windowName?: string) => void;
    focusBrowserView: () => void;
    reloadCurrentView: () => void;
    closeDownloadsDropdown: () => void;
    closeDownloadsDropdownMenu: () => void;
    openDownloadsDropdown: () => void;
    goBack: () => void;
    checkForUpdates: () => void;
    updateConfiguration: (saveQueueItems: SaveQueueItem[]) => void;

    updateTeams: (updatedTeams: Team[]) => Promise<void>;
    getConfiguration: (option?: keyof CombinedConfig) => Promise<CombinedConfig[keyof CombinedConfig] | CombinedConfig>;
    getVersion: () => Promise<{name: string; version: string}>;
    getDarkMode: () => Promise<boolean>;
    requestHasDownloads: () => Promise<boolean>;
    getFullScreenStatus: () => Promise<boolean>;
    getAvailableSpellCheckerLanguages: () => Promise<string[]>;
    getAvailableLanguages: () => Promise<string[]>;
    getLocalConfiguration: (option?: keyof LocalConfiguration) => Promise<LocalConfiguration[keyof LocalConfiguration] | Partial<LocalConfiguration>>;
    getDownloadLocation: (downloadLocation?: string) => Promise<string>;

    onSynchronizeConfig: (listener: () => void) => void;
    onReloadConfiguration: (listener: () => void) => void;
    onDarkModeChange: (listener: (darkMode: boolean) => void) => void;
    onLoadRetry: (listener: (viewName: string, retry: Date, err: string, loadUrl: string) => void) => void;
    onLoadSuccess: (listener: (viewName: string) => void) => void;
    onLoadFailed: (listener: (viewName: string, err: string, loadUrl: string) => void) => void;
    onSetActiveView: (listener: (serverName: string, tabName: string) => void) => void;
    onMaximizeChange: (listener: (maximize: boolean) => void) => void;
    onEnterFullScreen: (listener: () => void) => void;
    onLeaveFullScreen: (listener: () => void) => void;
    onPlaySound: (listener: (soundName: string) => void) => void;
    onModalOpen: (listener: () => void) => void;
    onModalClose: (listener: () => void) => void;
    onToggleBackButton: (listener: (showExtraBar: boolean) => void) => void;
    onUpdateMentions: (listener: (view: string, mentions: number, unreads: boolean, isExpired: boolean) => void) => void;
    onCloseTeamsDropdown: (listener: () => void) => void;
    onOpenTeamsDropdown: (listener: () => void) => void;
    onCloseDownloadsDropdown: (listener: () => void) => void;
    onOpenDownloadsDropdown: (listener: () => void) => void;
    onShowDownloadsDropdownButtonBadge: (listener: () => void) => void;
    onHideDownloadsDropdownButtonBadge: (listener: () => void) => void;
    onUpdateDownloadsDropdown: (listener: (downloads: DownloadedItems) => void) => void;
    onAppMenuWillClose: (listener: () => void) => void;
    onFocusThreeDotMenu: (listener: () => void) => void;
}
