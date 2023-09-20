// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import classNames from 'classnames';
import React, {Fragment} from 'react';
import {Container, Row} from 'react-bootstrap';
import {DropResult} from 'react-beautiful-dnd';
import {injectIntl, IntlShape} from 'react-intl';

import {UniqueView, UniqueServer} from 'types/config';
import {DownloadedItems} from 'types/downloads';

import restoreButton from '../../assets/titlebar/chrome-restore.svg';
import maximizeButton from '../../assets/titlebar/chrome-maximize.svg';
import minimizeButton from '../../assets/titlebar/chrome-minimize.svg';
import closeButton from '../../assets/titlebar/chrome-close.svg';

import {playSound} from '../notificationSounds';

import TabBar from './TabBar';
import ExtraBar from './ExtraBar';
import ErrorView from './ErrorView';
import ServerDropdownButton from './ServerDropdownButton';
import DownloadsDropdownButton from './DownloadsDropdown/DownloadsDropdownButton';

import '../css/components/UpgradeButton.scss';

enum Status {
    LOADING = 1,
    DONE = 2,
    RETRY = -1,
    FAILED = 0,
    NOSERVERS = -2,
}

type Props = {
    openMenu: () => void;
    darkMode: boolean;
    appName: string;
    useNativeWindow: boolean;
    intl: IntlShape;
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
    fullScreen?: boolean;
    showExtraBar?: boolean;
    isMenuOpen: boolean;
    isDownloadsDropdownOpen: boolean;
    showDownloadsBadge: boolean;
    hasDownloads: boolean;
    threeDotsIsFocused: boolean;
};

type TabViewStatus = {
    status: Status;
    extra?: {
        url: string;
        error: string;
    };
}

class MainPage extends React.PureComponent<Props, State> {
    threeDotMenu: React.RefObject<HTMLButtonElement>;
    topBar: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.topBar = React.createRef();
        this.threeDotMenu = React.createRef();

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
            threeDotsIsFocused: false,
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
        this.setState({servers, tabs, tabViewStatus});
        return Boolean(servers.length);
    }

    setInitialActiveTab = async () => {
        const lastActive = await window.desktop.getLastActive();
        this.setActiveView(lastActive.server, lastActive.view);
    }

    updateServers = async () => {
        const hasServers = await this.getServersAndTabs();
        if (hasServers && !(this.state.activeServerId && this.state.activeTabId)) {
            await this.setInitialActiveTab();
        }
    }

    async componentDidMount() {
        // request downloads
        await this.requestDownloadsLength();
        await this.updateServers();

        window.desktop.onUpdateServers(this.updateServers);

        // set page on retry
        window.desktop.onLoadRetry((viewId, retry, err, loadUrl) => {
            console.log(`${viewId}: failed to load ${err}, but retrying`);
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
            console.log(`${viewId}: failed to load ${err}`);
            const statusValue = {
                status: Status.FAILED,
                extra: {
                    error: err,
                    url: loadUrl,
                },
            };
            this.updateTabStatus(viewId, statusValue);
        });

        // can't switch tabs sequentially for some reason...
        window.desktop.onSetActiveView(this.setActiveView);

        window.desktop.onMaximizeChange(this.handleMaximizeState);

        window.desktop.onEnterFullScreen(() => this.handleFullScreenState(true));
        window.desktop.onLeaveFullScreen(() => this.handleFullScreenState(false));

        window.desktop.getFullScreenStatus().then((fullScreenStatus) => this.handleFullScreenState(fullScreenStatus));

        window.desktop.onPlaySound((soundName) => {
            playSound(soundName);
        });

        window.desktop.onModalOpen(() => {
            this.setState({modalOpen: true});
        });

        window.desktop.onModalClose(() => {
            this.setState({modalOpen: false});
        });

        window.desktop.onToggleBackButton((showExtraBar) => {
            this.setState({showExtraBar});
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

        window.desktop.onAppMenuWillClose(this.unFocusThreeDotsButton);

        if (window.process.platform !== 'darwin') {
            window.desktop.onFocusThreeDotMenu(this.focusThreeDotsButton);
        }

        window.addEventListener('click', this.handleCloseDropdowns);
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.handleCloseDropdowns);
    }

    setActiveView = (serverId: string, tabId: string) => {
        if (serverId === this.state.activeServerId && tabId === this.state.activeTabId) {
            return;
        }
        this.setState({activeServerId: serverId, activeTabId: tabId});
    }

    handleCloseDropdowns = () => {
        window.desktop.closeServersDropdown();
        this.closeDownloadsDropdown();
    }

    handleMaximizeState = (maximized: boolean) => {
        this.setState({maximized});
    }

    handleFullScreenState = (isFullScreen: boolean) => {
        this.setState({fullScreen: isFullScreen});
    }

    handleSelectTab = (tabId: string) => {
        window.desktop.switchTab(tabId);
    }

    handleCloseTab = (tabId: string) => {
        window.desktop.closeView(tabId);
    }

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
    }

    handleClose = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation(); // since it is our button, the event goes into MainPage's onclick event, getting focus back.
        window.desktop.closeWindow();
    }

    handleMinimize = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        window.desktop.minimizeWindow();
    }

    handleMaximize = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        window.desktop.maximizeWindow();
    }

    handleRestore = () => {
        window.desktop.restoreWindow();
    }

    openMenu = () => {
        this.props.openMenu();
    }

    handleDoubleClick = () => {
        window.desktop.doubleClickOnWindow();
    }

    focusOnWebView = () => {
        window.desktop.focusCurrentView();
        this.handleCloseDropdowns();
    }

    reloadCurrentView = () => {
        window.desktop.reloadCurrentView();
    }

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

    focusThreeDotsButton = () => {
        this.threeDotMenu.current?.focus();
        this.setState({
            threeDotsIsFocused: true,
        });
    }

    unFocusThreeDotsButton = () => {
        this.threeDotMenu.current?.blur();
        this.setState({
            threeDotsIsFocused: false,
        });
    }

    render() {
        const {intl} = this.props;
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
                onDrop={this.handleDragAndDrop}
                tabsDisabled={this.state.modalOpen}
                isMenuOpen={this.state.isMenuOpen || this.state.isDownloadsDropdownOpen}
            />
        );

        const topBarClassName = classNames('topBar', {
            macOS: window.process.platform === 'darwin',
            darkMode: this.props.darkMode,
            fullScreen: this.state.fullScreen,
        });

        const downloadsDropdownButton = this.state.hasDownloads ? (
            <DownloadsDropdownButton
                darkMode={this.props.darkMode}
                isDownloadsDropdownOpen={this.state.isDownloadsDropdownOpen}
                showDownloadsBadge={this.state.showDownloadsBadge}
                closeDownloadsDropdown={this.closeDownloadsDropdown}
                openDownloadsDropdown={this.openDownloadsDropdown}
            />
        ) : null;

        let maxButton;
        if (this.state.maximized || this.state.fullScreen) {
            maxButton = (
                <div
                    className='button restore-button'
                    onClick={this.handleRestore}
                >
                    <img
                        src={restoreButton}
                        draggable={false}
                    />
                </div>
            );
        } else {
            maxButton = (
                <div
                    className='button max-button'
                    onClick={this.handleMaximize}
                >
                    <img
                        src={maximizeButton}
                        draggable={false}
                    />
                </div>
            );
        }

        let titleBarButtons;
        if (window.process.platform === 'win32' && !this.props.useNativeWindow) {
            titleBarButtons = (
                <span className='title-bar-btns'>
                    <div
                        className='button min-button'
                        onClick={this.handleMinimize}
                    >
                        <img
                            src={minimizeButton}
                            draggable={false}
                        />
                    </div>
                    {maxButton}
                    <div
                        className='button close-button'
                        onClick={this.handleClose}
                    >
                        <img
                            src={closeButton}
                            draggable={false}
                        />
                    </div>
                </span>
            );
        }

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

        const topRow = (
            <Row
                className={topBarClassName}
                onDoubleClick={this.handleDoubleClick}
            >
                <div
                    ref={this.topBar}
                    className={'topBar-bg'}
                >
                    {window.process.platform !== 'linux' && this.state.servers.length === 0 && (
                        <div className='app-title'>
                            {intl.formatMessage({id: 'renderer.components.mainPage.titleBar', defaultMessage: '{appName}'}, {appName: this.props.appName})}
                        </div>
                    )}
                    <button
                        ref={this.threeDotMenu}
                        className='three-dot-menu'
                        onClick={this.openMenu}
                        onMouseOver={this.focusThreeDotsButton}
                        onMouseOut={this.unFocusThreeDotsButton}
                        tabIndex={0}
                        aria-label={intl.formatMessage({id: 'renderer.components.mainPage.contextMenu.ariaLabel', defaultMessage: 'Context menu'})}
                    >
                        <i
                            className={classNames('icon-dots-vertical', {
                                isFocused: this.state.threeDotsIsFocused,
                            })}
                        />
                    </button>
                    {activeServer && (
                        <ServerDropdownButton
                            isDisabled={this.state.modalOpen}
                            activeServerName={activeServer.name}
                            totalMentionCount={totalMentionCount}
                            hasUnreads={hasAnyUnreads}
                            isMenuOpen={this.state.isMenuOpen}
                            darkMode={this.props.darkMode}
                        />
                    )}
                    {tabsRow}
                    {downloadsDropdownButton}
                    {titleBarButtons}
                </div>
            </Row>
        );

        const views = () => {
            if (!activeServer) {
                return null;
            }
            let component;
            const tabStatus = this.getTabViewStatus();
            if (!tabStatus) {
                if (this.state.activeTabId) {
                    console.error(`Not tabStatus for ${this.state.activeTabId}`);
                }
                return null;
            }
            switch (tabStatus.status) {
            case Status.FAILED:
                component = (
                    <ErrorView
                        id={activeServer.name + '-fail'}
                        errorInfo={tabStatus.extra?.error}
                        url={tabStatus.extra ? tabStatus.extra.url : ''}
                        active={true}
                        appName={this.props.appName}
                        handleLink={this.reloadCurrentView}
                    />);
                break;
            case Status.LOADING:
            case Status.RETRY:
            case Status.DONE:
                component = null;
            }
            return component;
        };

        const viewsRow = (
            <Fragment>
                <ExtraBar
                    darkMode={this.props.darkMode}
                    show={this.state.showExtraBar}
                    goBack={() => {
                        window.desktop.goBack();
                    }}
                />
                <Row>
                    {views()}
                </Row>
            </Fragment>);

        return (
            <div
                className='MainPage'
                onClick={this.focusOnWebView}
            >
                <Container fluid={true}>
                    {topRow}
                    {viewsRow}
                </Container>
            </div>
        );
    }
}

export default injectIntl(MainPage);
