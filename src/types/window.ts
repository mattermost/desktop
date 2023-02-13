// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcRenderer, Rectangle} from 'electron/renderer';

import {Language} from '../../i18n/i18n';

import {CombinedConfig, LocalConfiguration, Team, TeamWithTabsAndGpo} from './config';
import {DownloadedItem, DownloadedItems, DownloadsMenuOpenEventPayload} from './downloads';
import {SaveQueueItem} from './settings';

declare global {
    interface Window {
        ipcRenderer: {
            send: typeof ipcRenderer.send;
            on: (channel: string, listener: (...args: any[]) => void) => void;
            invoke: typeof ipcRenderer.invoke;
        };
        process: {
            platform: NodeJS.Platform;
            env: {
                user?: string;
                username?: string;
            };
        };
        timers: {
            setImmediate: typeof setImmediate;
        };
        mas: {
            getThumbnailLocation: (location: string) => Promise<string>;
        };
        desktop: {
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
            getLanguageInformation: () => Promise<Language>;

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
            onUpdateDownloadsDropdown: (listener: (downloads: DownloadedItems, darkMode: boolean, windowBounds: Rectangle, item: DownloadedItem) => void) => void;
            onAppMenuWillClose: (listener: () => void) => void;
            onFocusThreeDotMenu: (listener: () => void) => void;

            updateURLViewWidth: (width?: number) => void;

            modals: {
                cancelModal: <T>(data?: T) => void;
                finishModal: <T>(data?: T) => void;
                getModalInfo: <T>() => Promise<T>;
                isModalUncloseable: () => Promise<boolean>;
                confirmProtocol: (protocol: string, url: string) => void;
                pingDomain: (url: string) => Promise<string>;
            };

            loadingScreen: {
                loadingScreenAnimationFinished: () => void;
                onToggleLoadingScreenVisibility: (listener: (toggle: boolean) => void) => void;
            };

            downloadsDropdown: {
                requestInfo: () => void;
                sendSize: (width: number, height: number) => void;
                openFile: (item: DownloadedItem) => void;
                startUpdateDownload: () => void;
                startUpgrade: () => void;
                requestClearDownloadsDropdown: () => void;
                toggleDownloadsDropdownMenu: (payload: DownloadsMenuOpenEventPayload) => void;
                focus: () => void;
            };

            downloadsDropdownMenu: {
                requestInfo: () => void;
                showInFolder: (item: DownloadedItem) => void;
                cancelDownload: (item: DownloadedItem) => void;
                clearFile: (item: DownloadedItem) => void;
                openFile: (item: DownloadedItem) => void;

                onUpdateDownloadsDropdownMenu: (listener: (item: DownloadedItem, darkMode: boolean) => void) => void;
            };

            serverDropdown: {
                requestInfo: () => void;
                sendSize: (width: number, height: number) => void;
                switchServer: (serverName: string) => void;
                showNewServerModal: () => void;
                showEditServerModal: (serverName: string) => void;
                showRemoveServerModal: (serverName: string) => void;

                onUpdateServerDropdown: (listener: (
                    teams: TeamWithTabsAndGpo[],
                    darkMode: boolean,
                    windowBounds: Rectangle,
                    activeTeam?: string,
                    enableServerManagement?: boolean,
                    hasGPOTeams?: boolean,
                    expired?: Map<string, boolean>,
                    mentions?: Map<string, number>,
                    unreads?: Map<string, boolean>,
                ) => void) => void;
            };
        };
    }
}
