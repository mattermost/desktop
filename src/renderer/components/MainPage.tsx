// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {DropResult} from 'react-beautiful-dnd';

import type {UniqueView, UniqueServer} from 'types/config';
import type {DownloadedItems} from 'types/downloads';

import BasePage, {ErrorState} from './BasePage';
import DeveloperModeIndicator from './DeveloperModeIndicator';
import DownloadsDropdownButton from './DownloadsDropdown/DownloadsDropdownButton';
import ServerDropdownButton from './ServerDropdownButton';
import TabBar from './TabBar';

import {playSound} from '../notificationSounds';

import '../css/components/UpgradeButton.scss';
import '../css/components/BasePage.css';
import '../css/components/TopBar.scss';

enum Status {
    LOADING = 1,
    DONE = 2,
    RETRY = -1,
    FAILED = 0,
    NOSERVERS = -2,
    INCOMPATIBLE = -3,
}

type Props = {
    openMenu: () => void;
    darkMode: boolean;
    appName: string;
};

type State = {
    activeServerId?: string;
    activeTabId?: string;
    servers: UniqueServer[];
    tabs: Map<string, UniqueView[]>;
    sessionsExpired: Record<string, boolean>;
    unreadCounts: Record<string, boolean>;
    mentionCounts: Record<string, number>;
    maximized: boolean;
    tabViewStatus: Map<string, TabViewStatus>;
    modalOpen?: boolean;
    isMenuOpen: boolean;
    isDownloadsDropdownOpen: boolean;
    showDownloadsBadge: boolean;
    hasDownloads: boolean;
    developerMode: boolean;
    primaryTabId?: string;
    currentServer?: UniqueServer;
};

type TabViewStatus = {
    status: Status;
    extra?: {
        url: string;
        error?: string;
    };
}

class MainPage extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            servers: [],
            tabs: new Map(),
            sessionsExpired: {},
            unreadCounts: {},
            mentionCounts: {},
            maximized: false,
            tabViewStatus: new Map(),
            isMenuOpen: false,
            isDownloadsDropdownOpen: false,
            showDownloadsBadge: false,
            hasDownloads: false,
            developerMode: false,
        };
    }

    getTabViewStatus() {
        if (!this.state.activeTabId) {
            return undefined;
        }
        return this.state.tabViewStatus.get(this.state.activeTabId) ?? {status: Status.NOSERVERS};
    }

    updateTabStatus(tabViewName: string, newStatusValue: TabViewStatus) {
        const status = new Map(this.state.tabViewStatus);
        status.set(tabViewName, newStatusValue);
        this.setState({tabViewStatus: status});
    }

    async requestDownloadsLength() {
        try {
            const hasDownloads = await window.desktop.requestHasDownloads();
            this.setState({
                hasDownloads,
            });
        } catch (error) {
            console.error(error);
        }
    }

    getServersAndTabs = async () => {
        const servers = await window.desktop.getOrderedServers();
        const tabs = new Map();
        const tabViewStatus = new Map(this.state.tabViewStatus);
        await Promise.all(
            servers.map((srv) => window.desktop.getOrderedTabsForServer(srv.id!).
                then((tabs) => ({id: srv.id, tabs}))),
        ).then((serverTabs) => {
            serverTabs.forEach((serverTab) => {
                tabs.set(serverTab.id, serverTab.tabs);
                serverTab.tabs.forEach((tab) => {
                    if (!tabViewStatus.has(tab.id!)) {
                        tabViewStatus.set(tab.id!, {status: Status.LOADING});
                    }
                });
            });
        });
        this.setState({servers, tabs, tabViewStatus, currentServer: servers.find((srv) => srv.id === this.state.activeServerId)});
        return Boolean(servers.length);
    };

    setInitialActiveTab = async () => {
        const currentServer = await window.desktop.getCurrentServer();
        if (!currentServer?.id) {
            return;
        }
        const view = await window.desktop.getActiveTabForServer(currentServer.id);
        if (view) {
            this.setState({
                currentServer,
                activeServerId: currentServer.id,
                activeTabId: view.id,
            });
        }
    };

    updateServers = async () => {
        const hasServers = await this.getServersAndTabs();
        if (hasServers && !(this.state.activeServerId && this.state.activeTabId)) {
            await this.setInitialActiveTab();
        }
    };

    handleServerAdded = async (serverId: string, setAsCurrentServer: boolean) => {
        // Refresh servers and tabs when a server is added
        await this.updateServers();
        if (setAsCurrentServer) {
            await this.setInitialActiveTab();
        }
    };

    handleServerSwitched = async () => {
        const currentServer = await window.desktop.getCurrentServer();
        if (currentServer?.id) {
            this.setState({
                currentServer,
                activeServerId: currentServer.id,
            });
        }
    };

    async componentDidMount() {
        // request downloads
        await this.requestDownloadsLength();
        await this.updateServers();

        window.desktop.onServerAdded(this.handleServerAdded);
        window.desktop.onServerRemoved(this.updateServers);
        window.desktop.onServerUrlChanged(this.updateServers);
        window.desktop.onServerNameChanged(this.updateServers);
        window.desktop.onServerSwitched(this.handleServerSwitched);
        window.desktop.onServerLoggedInChanged(this.updateServers);
        window.desktop.onTabAdded(this.updateServers);
        window.desktop.onTabRemoved(this.updateServers);

        // Add tab title update handler
        window.desktop.onUpdateTabTitle((viewId, title) => {
            const tabs = new Map(this.state.tabs);
            for (const [serverId, serverTabs] of tabs.entries()) {
                const tab = serverTabs.find((t) => t.id === viewId);
                if (tab) {
                    const updatedTabs = serverTabs.map((t) =>
                        (t.id === viewId ? {...t, title} : t),
                    );
                    tabs.set(serverId, updatedTabs);
                    this.setState({tabs});
                    break;
                }
            }
        });

        // set page on retry
        window.desktop.onLoadRetry((viewId, retry, err, loadUrl) => {
            console.error(`${viewId}: failed to load ${err}, but retrying`);
            const statusValue = {
                status: Status.RETRY,
                extra: {
                    retry,
                    error: err,
                    url: loadUrl,
                },
            };
            this.updateTabStatus(viewId, statusValue);
        });

        window.desktop.onLoadSuccess((viewId) => {
            this.updateTabStatus(viewId, {status: Status.DONE});
        });

        window.desktop.onLoadFailed((viewId, err, loadUrl) => {
            console.error(`${viewId}: failed to load ${err}`);
            const statusValue = {
                status: Status.FAILED,
                extra: {
                    error: err,
                    url: loadUrl,
                },
            };
            this.updateTabStatus(viewId, statusValue);
        });

        window.desktop.onLoadIncompatibleServer((viewId, loadUrl) => {
            console.error(`${viewId}: tried to load incompatible server`);
            const statusValue = {
                status: Status.INCOMPATIBLE,
                extra: {
                    url: loadUrl,
                },
            };
            this.updateTabStatus(viewId, statusValue);
        });

        // can't switch tabs sequentially for some reason...
        window.desktop.onSetActiveView(this.setActiveView);

        window.desktop.onMaximizeChange(this.handleMaximizeState);

        window.desktop.onPlaySound((soundName) => {
            playSound(soundName);
        });

        window.desktop.onModalOpen(() => {
            this.setState({modalOpen: true});
        });

        window.desktop.onModalClose(() => {
            this.setState({modalOpen: false});
        });

        window.desktop.onUpdateMentions((view, mentions, unreads, isExpired) => {
            const {unreadCounts, mentionCounts, sessionsExpired} = this.state;

            const newMentionCounts = {...mentionCounts};
            newMentionCounts[view] = mentions || 0;

            const newUnreads = {...unreadCounts};
            newUnreads[view] = unreads || false;

            const expired = {...sessionsExpired};
            expired[view] = isExpired || false;

            this.setState({unreadCounts: newUnreads, mentionCounts: newMentionCounts, sessionsExpired: expired});
        });

        window.desktop.onCloseServersDropdown(() => {
            this.setState({isMenuOpen: false});
        });

        window.desktop.onOpenServersDropdown(() => {
            this.setState({isMenuOpen: true});
        });

        window.desktop.onCloseDownloadsDropdown(() => {
            this.setState({isDownloadsDropdownOpen: false});
        });

        window.desktop.onOpenDownloadsDropdown(() => {
            this.setState({isDownloadsDropdownOpen: true});
        });

        window.desktop.onShowDownloadsDropdownButtonBadge(() => {
            this.setState({showDownloadsBadge: true});
        });

        window.desktop.onHideDownloadsDropdownButtonBadge(() => {
            this.setState({showDownloadsBadge: false});
        });

        window.desktop.onUpdateDownloadsDropdown((downloads: DownloadedItems) => {
            this.setState({
                hasDownloads: (Object.values(downloads)?.length || 0) > 0,
            });
        });

        window.addEventListener('click', this.handleCloseDropdowns);

        window.desktop.isDeveloperModeEnabled().then((developerMode) => {
            this.setState({developerMode});
        });
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.handleCloseDropdowns);
    }

    setActiveView = async (serverId: string, tabId: string) => {
        await this.updateServers();
        if (serverId === this.state.activeServerId && serverId === this.state.activeTabId) {
            return;
        }

        // Find the current server
        const currentServer = this.state.servers.find((srv) => srv.id === serverId);
        if (!currentServer) {
            return;
        }

        // Find the tab in the current server's tabs
        const serverTabs = this.state.tabs.get(serverId) || [];
        const tab = serverTabs.find((t) => t.id === tabId);
        if (!tab) {
            return;
        }

        this.setState({
            activeServerId: serverId,
            activeTabId: tabId,
            currentServer,
        });
    };

    handleCloseDropdowns = () => {
        window.desktop.closeServersDropdown();
        this.closeDownloadsDropdown();
    };

    handleMaximizeState = (maximized: boolean) => {
        this.setState({maximized});
    };

    handleSelectTab = (tabId: string) => {
        window.desktop.switchTab(tabId);
    };

    handleCloseTab = async (viewId: string) => {
        await window.desktop.closeTab(viewId);
        await this.updateServers();
    };

    handleDragAndDrop = async (dropResult: DropResult) => {
        const removedIndex = dropResult.source.index;
        const addedIndex = dropResult.destination?.index;
        if (addedIndex === undefined || removedIndex === addedIndex) {
            return;
        }
        if (!(this.state.activeServerId && this.state.tabs.has(this.state.activeServerId))) {
            // TODO: figure out something here
            return;
        }
        const currentTabs = this.state.tabs.get(this.state.activeServerId)!;
        const tabsCopy = currentTabs.concat();

        const tab = tabsCopy.splice(removedIndex, 1);
        const newOrder = addedIndex < currentTabs.length ? addedIndex : currentTabs.length - 1;
        tabsCopy.splice(newOrder, 0, tab[0]);

        window.desktop.updateTabOrder(this.state.activeServerId, tabsCopy.map((tab) => tab.id!));
        const tabs = new Map(this.state.tabs);
        tabs.set(this.state.activeServerId, tabsCopy);
        this.setState({tabs});
        this.handleSelectTab(tab[0].id!);
    };

    showHideDownloadsBadge(value = false) {
        this.setState({showDownloadsBadge: value});
    }

    closeDownloadsDropdown() {
        window.desktop.closeDownloadsDropdown();
        window.desktop.closeDownloadsDropdownMenu();
    }

    openDownloadsDropdown() {
        window.desktop.openDownloadsDropdown();
    }

    openServerExternally = () => {
        window.desktop.openServerExternally();
    };

    handleNewTab = async () => {
        const {currentServer} = this.state;
        if (!currentServer?.id) {
            return;
        }

        const newTabId = await window.desktop.createNewTab(currentServer.id);
        await this.updateServers();
        if (newTabId) {
            await window.desktop.switchTab(newTabId);
        }
    };

    handleOpenPopoutMenu = (viewId: string) => {
        window.desktop.openPopoutMenu(viewId);
    };

    render() {
        let currentTabs: UniqueView[] = [];
        if (this.state.activeServerId) {
            currentTabs = this.state.tabs.get(this.state.activeServerId) ?? [];
        }

        const tabsRow = (
            <TabBar
                id='tabBar'
                isDarkMode={this.props.darkMode}
                tabs={currentTabs}
                sessionsExpired={this.state.sessionsExpired}
                unreadCounts={this.state.unreadCounts}
                mentionCounts={this.state.mentionCounts}
                activeServerId={this.state.activeServerId}
                activeTabId={this.state.activeTabId}
                onSelect={this.handleSelectTab}
                onCloseTab={this.handleCloseTab}
                onOpenPopoutMenu={this.handleOpenPopoutMenu}
                onNewTab={this.handleNewTab}
                onDrop={this.handleDragAndDrop}
                tabsDisabled={this.state.modalOpen || !this.state.currentServer?.isLoggedIn}
                isMenuOpen={this.state.isMenuOpen || this.state.isDownloadsDropdownOpen}
            />
        );

        const downloadsDropdownButton = this.state.hasDownloads ? (
            <DownloadsDropdownButton
                darkMode={this.props.darkMode}
                isDownloadsDropdownOpen={this.state.isDownloadsDropdownOpen}
                showDownloadsBadge={this.state.showDownloadsBadge}
                closeDownloadsDropdown={this.closeDownloadsDropdown}
                openDownloadsDropdown={this.openDownloadsDropdown}
            />
        ) : null;

        const totalMentionCount = Object.keys(this.state.mentionCounts).reduce((sum, key) => {
            // Strip out current server from unread and mention counts
            if (this.state.tabs.get(this.state.activeServerId!)?.map((tab) => tab.id).includes(key)) {
                return sum;
            }
            return sum + this.state.mentionCounts[key];
        }, 0);
        const hasAnyUnreads = Object.keys(this.state.unreadCounts).reduce((sum, key) => {
            if (this.state.tabs.get(this.state.activeServerId!)?.map((tab) => tab.id).includes(key)) {
                return sum;
            }
            return sum || this.state.unreadCounts[key];
        }, false);

        const activeServer = this.state.servers.find((srv) => srv.id === this.state.activeServerId);
        const tabStatus = activeServer && this.getTabViewStatus();
        if (!tabStatus) {
            if (this.state.activeTabId) {
                console.error(`Not tabStatus for ${this.state.activeTabId}`);
            }
        }
        let errorState: ErrorState | undefined;
        if (tabStatus?.status === Status.FAILED) {
            errorState = ErrorState.FAILED;
        } else if (tabStatus?.status === Status.INCOMPATIBLE) {
            errorState = ErrorState.INCOMPATIBLE;
        }

        return (
            <BasePage
                darkMode={this.props.darkMode}
                appName={this.props.appName}
                openMenu={this.props.openMenu}
                title={window.process.platform !== 'linux' && this.state.servers.length === 0 ? this.props.appName : undefined}
                errorState={errorState}
                errorMessage={tabStatus?.extra?.error}
                errorUrl={tabStatus?.extra?.url}
            >
                {activeServer && (
                    <>
                        <ServerDropdownButton
                            isDisabled={this.state.modalOpen}
                            activeServerName={activeServer.name}
                            totalMentionCount={totalMentionCount}
                            hasUnreads={hasAnyUnreads}
                            isMenuOpen={this.state.isMenuOpen}
                            darkMode={this.props.darkMode}
                        />
                    </>
                )}
                {tabsRow}
                <DeveloperModeIndicator
                    darkMode={this.props.darkMode}
                    developerMode={this.state.developerMode}
                />
                {downloadsDropdownButton}
            </BasePage>
        );
    }
}

export default MainPage;
