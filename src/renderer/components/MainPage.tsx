// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import classNames from 'classnames';
import React, {Fragment} from 'react';
import {Container, Row} from 'react-bootstrap';
import {DropResult} from 'react-beautiful-dnd';
import {injectIntl, IntlShape} from 'react-intl';

import {TeamWithTabs} from 'types/config';
import {DownloadedItems} from 'types/downloads';

import {getTabViewName} from 'common/tabs/TabView';

import {getAPI} from 'renderer/api';

import restoreButton from '../../assets/titlebar/chrome-restore.svg';
import maximizeButton from '../../assets/titlebar/chrome-maximize.svg';
import minimizeButton from '../../assets/titlebar/chrome-minimize.svg';
import closeButton from '../../assets/titlebar/chrome-close.svg';

import {playSound} from '../notificationSounds';

import TabBar from './TabBar';
import ExtraBar from './ExtraBar';
import ErrorView from './ErrorView';
import TeamDropdownButton from './TeamDropdownButton';
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
    teams: TeamWithTabs[];
    lastActiveTeam?: number;
    moveTabs: (teamName: string, originalOrder: number, newOrder: number) => number | undefined;
    openMenu: () => void;
    darkMode: boolean;
    appName: string;
    useNativeWindow: boolean;
    intl: IntlShape;
};

type State = {
    activeServerName?: string;
    activeTabName?: string;
    sessionsExpired: Record<string, boolean>;
    unreadCounts: Record<string, boolean>;
    mentionCounts: Record<string, number>;
    maximized: boolean;
    tabViewStatus: Map<string, TabViewStatus>;
    darkMode: boolean;
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
    topBar: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.topBar = React.createRef();

        const firstServer = this.props.teams.find((team) => team.order === this.props.lastActiveTeam) || this.props.teams.find((team) => team.order === 0);
        let firstTab = firstServer?.tabs.find((tab) => tab.order === firstServer.lastActiveTab) || firstServer?.tabs.find((tab) => tab.order === 0);
        if (!firstTab?.isOpen) {
            const openTabs = firstServer?.tabs.filter((tab) => tab.isOpen) || [];
            firstTab = openTabs?.find((e) => e.order === 0) || openTabs[0];
        }

        this.state = {
            activeServerName: firstServer?.name,
            activeTabName: firstTab?.name,
            sessionsExpired: {},
            unreadCounts: {},
            mentionCounts: {},
            maximized: false,
            tabViewStatus: new Map(this.props.teams.map((team) => team.tabs.map((tab) => getTabViewName(team.name, tab.name))).flat().map((tabViewName) => [tabViewName, {status: Status.LOADING}])),
            darkMode: this.props.darkMode,
            isMenuOpen: false,
            isDownloadsDropdownOpen: false,
            showDownloadsBadge: false,
            hasDownloads: false,
            threeDotsIsFocused: false,
        };
    }

    getTabViewStatus() {
        if (!this.state.activeServerName || !this.state.activeTabName) {
            return undefined;
        }
        return this.state.tabViewStatus.get(getTabViewName(this.state.activeServerName, this.state.activeTabName)) ?? {status: Status.NOSERVERS};
    }

    updateTabStatus(tabViewName: string, newStatusValue: TabViewStatus) {
        const status = new Map(this.state.tabViewStatus);
        status.set(tabViewName, newStatusValue);
        this.setState({tabViewStatus: status});
    }

    async requestDownloadsLength() {
        try {
            const hasDownloads = await getAPI().requestHasDownloads();
            this.setState({
                hasDownloads,
            });
        } catch (error) {
            console.error(error);
        }
    }

    componentDidMount() {
        // request downloads
        this.requestDownloadsLength();

        // set page on retry
        getAPI().onLoadRetry((viewName, retry, err, loadUrl) => {
            console.log(`${viewName}: failed to load ${err}, but retrying`);
            const statusValue = {
                status: Status.RETRY,
                extra: {
                    retry,
                    error: err,
                    url: loadUrl,
                },
            };
            this.updateTabStatus(viewName, statusValue);
        });

        getAPI().onLoadSuccess((viewName) => {
            this.updateTabStatus(viewName, {status: Status.DONE});
        });

        getAPI().onLoadFailed((viewName, err, loadUrl) => {
            console.log(`${viewName}: failed to load ${err}`);
            const statusValue = {
                status: Status.FAILED,
                extra: {
                    error: err,
                    url: loadUrl,
                },
            };
            this.updateTabStatus(viewName, statusValue);
        });

        getAPI().onDarkModeChange((darkMode) => {
            this.setState({darkMode});
        });

        // can't switch tabs sequentially for some reason...
        getAPI().onSetActiveView((serverName, tabName) => {
            this.setState({activeServerName: serverName, activeTabName: tabName});
        });

        getAPI().onMaximizeChange(this.handleMaximizeState);

        getAPI().onEnterFullScreen(() => this.handleFullScreenState(true));
        getAPI().onLeaveFullScreen(() => this.handleFullScreenState(false));

        getAPI().getFullScreenStatus().then((fullScreenStatus) => this.handleFullScreenState(fullScreenStatus));

        getAPI().onPlaySound((soundName) => {
            playSound(soundName);
        });

        getAPI().onModalOpen(() => {
            this.setState({modalOpen: true});
        });

        getAPI().onModalClose(() => {
            this.setState({modalOpen: false});
        });

        getAPI().onToggleBackButton((showExtraBar) => {
            this.setState({showExtraBar});
        });

        getAPI().onUpdateMentions((view, mentions, unreads, isExpired) => {
            const {unreadCounts, mentionCounts, sessionsExpired} = this.state;

            const newMentionCounts = {...mentionCounts};
            newMentionCounts[view] = mentions || 0;

            const newUnreads = {...unreadCounts};
            newUnreads[view] = unreads || false;

            const expired = {...sessionsExpired};
            expired[view] = isExpired || false;

            this.setState({unreadCounts: newUnreads, mentionCounts: newMentionCounts, sessionsExpired: expired});
        });

        getAPI().onCloseTeamsDropdown(() => {
            this.setState({isMenuOpen: false});
        });

        getAPI().onOpenTeamsDropdown(() => {
            this.setState({isMenuOpen: true});
        });

        getAPI().onCloseDownloadsDropdown(() => {
            this.setState({isDownloadsDropdownOpen: false});
        });

        getAPI().onOpenDownloadsDropdown(() => {
            this.setState({isDownloadsDropdownOpen: true});
        });

        getAPI().onShowDownloadsDropdownButtonBadge(() => {
            this.setState({showDownloadsBadge: true});
        });

        getAPI().onHideDownloadsDropdownButtonBadge(() => {
            this.setState({showDownloadsBadge: false});
        });

        getAPI().onUpdateDownloadsDropdown((downloads: DownloadedItems) => {
            this.setState({
                hasDownloads: (Object.values(downloads)?.length || 0) > 0,
            });
        });

        getAPI().onAppMenuWillClose(this.unFocusThreeDotsButton);

        if (window.process.platform !== 'darwin') {
            getAPI().onFocusThreeDotMenu(this.focusThreeDotsButton);
        }

        window.addEventListener('click', this.handleCloseDropdowns);
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.handleCloseDropdowns);
    }

    handleCloseDropdowns = () => {
        getAPI().closeTeamsDropdown();
        this.closeDownloadsDropdown();
    }

    handleMaximizeState = (maximized: boolean) => {
        this.setState({maximized});
    }

    handleFullScreenState = (isFullScreen: boolean) => {
        this.setState({fullScreen: isFullScreen});
    }

    handleSelectTab = (name: string) => {
        if (!this.state.activeServerName) {
            return;
        }
        getAPI().switchTab(this.state.activeServerName, name);
    }

    handleCloseTab = (name: string) => {
        if (!this.state.activeServerName) {
            return;
        }
        getAPI().closeTab(this.state.activeServerName, name);
    }

    handleDragAndDrop = async (dropResult: DropResult) => {
        const removedIndex = dropResult.source.index;
        const addedIndex = dropResult.destination?.index;
        if (addedIndex === undefined || removedIndex === addedIndex) {
            return;
        }
        if (!this.state.activeServerName) {
            return;
        }
        const currentTabs = this.props.teams.find((team) => team.name === this.state.activeServerName)?.tabs;
        if (!currentTabs) {
            // TODO: figure out something here
            return;
        }
        const teamIndex = this.props.moveTabs(this.state.activeServerName, removedIndex, addedIndex < currentTabs.length ? addedIndex : currentTabs.length - 1);
        if (!teamIndex) {
            return;
        }
        const name = currentTabs[teamIndex].name;
        this.handleSelectTab(name);
    }

    handleClose = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation(); // since it is our button, the event goes into MainPage's onclick event, getting focus back.
        getAPI().closeWindow();
    }

    handleMinimize = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        getAPI().minimizeWindow();
    }

    handleMaximize = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        getAPI().maximizeWindow();
    }

    handleRestore = () => {
        getAPI().restoreWindow();
    }

    openMenu = () => {
        this.props.openMenu();
    }

    handleDoubleClick = () => {
        getAPI().doubleClickOnWindow();
    }

    focusOnWebView = () => {
        getAPI().focusBrowserView();
        this.handleCloseDropdowns();
    }

    reloadCurrentView = () => {
        getAPI().reloadCurrentView();
    }

    showHideDownloadsBadge(value = false) {
        this.setState({showDownloadsBadge: value});
    }

    closeDownloadsDropdown() {
        getAPI().closeDownloadsDropdown();
        getAPI().closeDownloadsDropdownMenu();
    }

    openDownloadsDropdown() {
        getAPI().openDownloadsDropdown();
    }

    focusThreeDotsButton = () => {
        this.setState({
            threeDotsIsFocused: true,
        });
    }

    unFocusThreeDotsButton = () => {
        this.setState({
            threeDotsIsFocused: false,
        });
    }

    render() {
        const {intl} = this.props;
        const currentTabs = this.props.teams.find((team) => team.name === this.state.activeServerName)?.tabs || [];

        const tabsRow = (
            <TabBar
                id='tabBar'
                isDarkMode={this.state.darkMode}
                tabs={currentTabs}
                sessionsExpired={this.state.sessionsExpired}
                unreadCounts={this.state.unreadCounts}
                mentionCounts={this.state.mentionCounts}
                activeServerName={this.state.activeServerName}
                activeTabName={this.state.activeTabName}
                onSelect={this.handleSelectTab}
                onCloseTab={this.handleCloseTab}
                onDrop={this.handleDragAndDrop}
                tabsDisabled={this.state.modalOpen}
                isMenuOpen={this.state.isMenuOpen || this.state.isDownloadsDropdownOpen}
            />
        );

        const topBarClassName = classNames('topBar', {
            macOS: window.process.platform === 'darwin',
            darkMode: this.state.darkMode,
            fullScreen: this.state.fullScreen,
        });

        const downloadsDropdownButton = this.state.hasDownloads ? (
            <DownloadsDropdownButton
                darkMode={this.state.darkMode}
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

        const serverMatch = `${this.state.activeServerName}___TAB_[A-Z]+`;
        const totalMentionCount = Object.keys(this.state.mentionCounts).reduce((sum, key) => {
            // Strip out current server from unread and mention counts
            if (this.state.activeServerName && key.match(serverMatch)) {
                return sum;
            }
            return sum + this.state.mentionCounts[key];
        }, 0);
        const hasAnyUnreads = Object.keys(this.state.unreadCounts).reduce((sum, key) => {
            if (this.state.activeServerName && key.match(serverMatch)) {
                return sum;
            }
            return sum || this.state.unreadCounts[key];
        }, false);
        const topRow = (
            <Row
                className={topBarClassName}
                onDoubleClick={this.handleDoubleClick}
            >
                <div
                    ref={this.topBar}
                    className={'topBar-bg'}
                >
                    {window.process.platform !== 'linux' && this.props.teams.length === 0 && (
                        <div className='app-title'>
                            {intl.formatMessage({id: 'renderer.components.mainPage.titleBar', defaultMessage: 'Mattermost'})}
                        </div>
                    )}
                    <button
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
                    {this.props.teams.length !== 0 && (
                        <TeamDropdownButton
                            isDisabled={this.state.modalOpen}
                            activeServerName={this.state.activeServerName}
                            totalMentionCount={totalMentionCount}
                            hasUnreads={hasAnyUnreads}
                            isMenuOpen={this.state.isMenuOpen}
                            darkMode={this.state.darkMode}
                        />
                    )}
                    {tabsRow}
                    {downloadsDropdownButton}
                    {titleBarButtons}
                </div>
            </Row>
        );

        const views = () => {
            if (!this.props.teams.length) {
                return null;
            }
            let component;
            const tabStatus = this.getTabViewStatus();
            if (!tabStatus) {
                if (this.state.activeTabName || this.state.activeServerName) {
                    console.error(`Not tabStatus for ${this.state.activeTabName}`);
                }
                return null;
            }
            switch (tabStatus.status) {
            case Status.FAILED:
                component = (
                    <ErrorView
                        id={this.state.activeTabName + '-fail'}
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
                    darkMode={this.state.darkMode}
                    show={this.state.showExtraBar}
                    goBack={() => {
                        getAPI().goBack();
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
