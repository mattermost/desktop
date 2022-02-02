// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {Fragment} from 'react';
import {Container, Row} from 'react-bootstrap';
import {DropResult} from 'react-beautiful-dnd';
import DotsVerticalIcon from 'mdi-react/DotsVerticalIcon';
import {IpcRendererEvent} from 'electron/renderer';

import {TeamWithTabs} from 'types/config';

import {getTabViewName} from 'common/tabs/TabView';

import {
    FOCUS_BROWSERVIEW,
    MAXIMIZE_CHANGE,
    DARK_MODE_CHANGE,
    HISTORY,
    LOAD_RETRY,
    LOAD_SUCCESS,
    LOAD_FAILED,
    WINDOW_CLOSE,
    WINDOW_MINIMIZE,
    WINDOW_RESTORE,
    WINDOW_MAXIMIZE,
    DOUBLE_CLICK_ON_WINDOW,
    PLAY_SOUND,
    MODAL_OPEN,
    MODAL_CLOSE,
    SET_ACTIVE_VIEW,
    UPDATE_MENTIONS,
    TOGGLE_BACK_BUTTON,
    FOCUS_THREE_DOT_MENU,
    GET_FULL_SCREEN_STATUS,
    CLOSE_TEAMS_DROPDOWN,
    OPEN_TEAMS_DROPDOWN,
    SWITCH_TAB,
    UPDATE_AVAILABLE,
    UPDATE_DOWNLOADED,
    START_UPGRADE,
    START_DOWNLOAD,
    CLOSE_TAB,
} from 'common/communication';

import restoreButton from '../../assets/titlebar/chrome-restore.svg';
import maximizeButton from '../../assets/titlebar/chrome-maximize.svg';
import minimizeButton from '../../assets/titlebar/chrome-minimize.svg';
import closeButton from '../../assets/titlebar/chrome-close.svg';

import {playSound} from '../notificationSounds';

import TabBar from './TabBar';
import ExtraBar from './ExtraBar';
import ErrorView from './ErrorView';
import TeamDropdownButton from './TeamDropdownButton';
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
};

type State = {
    activeServerName?: string;
    activeTabName?: string;
    sessionsExpired: Record<string, boolean>;
    unreadCounts: Record<string, number>;
    mentionCounts: Record<string, number>;
    maximized: boolean;
    tabViewStatus: Map<string, TabViewStatus>;
    darkMode: boolean;
    modalOpen?: boolean;
    fullScreen?: boolean;
    showExtraBar?: boolean;
    isMenuOpen: boolean;
    upgradeAvailable: boolean;
    upgradeDownloaded: boolean;
};

type TabViewStatus = {
    status: Status;
    extra?: {
        url: string;
        error: string;
    };
}

export default class MainPage extends React.PureComponent<Props, State> {
    topBar: React.RefObject<HTMLDivElement>;
    threeDotMenu: React.RefObject<HTMLButtonElement>;

    constructor(props: Props) {
        super(props);

        this.topBar = React.createRef();
        this.threeDotMenu = React.createRef();

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
            upgradeAvailable: false,
            upgradeDownloaded: false,
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

    componentDidMount() {
        // set page on retry
        window.ipcRenderer.on(LOAD_RETRY, (_, viewName, retry, err, loadUrl) => {
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

        window.ipcRenderer.on(LOAD_SUCCESS, (_, viewName) => {
            this.updateTabStatus(viewName, {status: Status.DONE});
        });

        window.ipcRenderer.on(LOAD_FAILED, (_, viewName, err, loadUrl) => {
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

        window.ipcRenderer.on(DARK_MODE_CHANGE, (_, darkMode) => {
            this.setState({darkMode});
        });

        // can't switch tabs sequentially for some reason...
        window.ipcRenderer.on(SET_ACTIVE_VIEW, (event, serverName, tabName) => {
            this.setState({activeServerName: serverName, activeTabName: tabName});
        });

        window.ipcRenderer.on(MAXIMIZE_CHANGE, this.handleMaximizeState);

        window.ipcRenderer.on('enter-full-screen', () => this.handleFullScreenState(true));
        window.ipcRenderer.on('leave-full-screen', () => this.handleFullScreenState(false));

        window.ipcRenderer.invoke(GET_FULL_SCREEN_STATUS).then((fullScreenStatus) => this.handleFullScreenState(fullScreenStatus));

        window.ipcRenderer.on(PLAY_SOUND, (_event, soundName) => {
            playSound(soundName);
        });

        window.ipcRenderer.on(MODAL_OPEN, () => {
            this.setState({modalOpen: true});
        });

        window.ipcRenderer.on(MODAL_CLOSE, () => {
            this.setState({modalOpen: false});
        });

        window.ipcRenderer.on(TOGGLE_BACK_BUTTON, (event, showExtraBar) => {
            this.setState({showExtraBar});
        });

        window.ipcRenderer.on(UPDATE_MENTIONS, (_event, view, mentions, unreads, isExpired) => {
            const {unreadCounts, mentionCounts, sessionsExpired} = this.state;

            const newMentionCounts = {...mentionCounts};
            newMentionCounts[view] = mentions || 0;

            const newUnreads = {...unreadCounts};
            newUnreads[view] = unreads || false;

            const expired = {...sessionsExpired};
            expired[view] = isExpired || false;

            this.setState({unreadCounts: newUnreads, mentionCounts: newMentionCounts, sessionsExpired: expired});
        });

        window.ipcRenderer.on(CLOSE_TEAMS_DROPDOWN, () => {
            this.setState({isMenuOpen: false});
        });

        window.ipcRenderer.on(OPEN_TEAMS_DROPDOWN, () => {
            this.setState({isMenuOpen: true});
        });

        window.ipcRenderer.on(UPDATE_AVAILABLE, () => {
            this.setState({upgradeAvailable: true});
        });

        window.ipcRenderer.on(UPDATE_DOWNLOADED, () => {
            this.setState({upgradeDownloaded: true, upgradeAvailable: false});
        });

        if (window.process.platform !== 'darwin') {
            window.ipcRenderer.on(FOCUS_THREE_DOT_MENU, () => {
                if (this.threeDotMenu.current) {
                    this.threeDotMenu.current.focus();
                }
            });
        }

        window.addEventListener('click', this.handleCloseTeamsDropdown);
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.handleCloseTeamsDropdown);
    }

    handleCloseTeamsDropdown = () => {
        window.ipcRenderer.send(CLOSE_TEAMS_DROPDOWN);
    }

    handleMaximizeState = (_: IpcRendererEvent, maximized: boolean) => {
        this.setState({maximized});
    }

    handleFullScreenState = (isFullScreen: boolean) => {
        this.setState({fullScreen: isFullScreen});
    }

    handleSelectTab = (name: string) => {
        window.ipcRenderer.send(SWITCH_TAB, this.state.activeServerName, name);
    }

    handleCloseTab = (name: string) => {
        window.ipcRenderer.send(CLOSE_TAB, this.state.activeServerName, name);
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
        window.ipcRenderer.send(WINDOW_CLOSE);
    }

    handleMinimize = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        window.ipcRenderer.send(WINDOW_MINIMIZE);
    }

    handleMaximize = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        window.ipcRenderer.send(WINDOW_MAXIMIZE);
    }

    handleRestore = () => {
        window.ipcRenderer.send(WINDOW_RESTORE);
    }

    openMenu = () => {
        if (window.process.platform !== 'darwin') {
            this.threeDotMenu.current?.blur();
        }
        this.props.openMenu();
    }

    handleDoubleClick = () => {
        window.ipcRenderer.send(DOUBLE_CLICK_ON_WINDOW);
    }

    focusOnWebView = () => {
        window.ipcRenderer.send(FOCUS_BROWSERVIEW);
        this.handleCloseTeamsDropdown();
    }

    render() {
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
                isMenuOpen={this.state.isMenuOpen}
            />
        );

        const topBarClassName = classNames('topBar', {
            macOS: window.process.platform === 'darwin',
            darkMode: this.state.darkMode,
            fullScreen: this.state.fullScreen,
        });

        let maxButton;
        if (this.state.maximized || this.state.fullScreen) {
            maxButton = (
                <div
                    className='button restore-button'
                    onClick={this.handleRestore}
                >
                    <img src={restoreButton}/>
                </div>
            );
        } else {
            maxButton = (
                <div
                    className='button max-button'
                    onClick={this.handleMaximize}
                >
                    <img src={maximizeButton}/>
                </div>
            );
        }

        let upgradeIcon;
        if (this.state.upgradeAvailable || this.state.upgradeDownloaded) {
            upgradeIcon = (
                <span className={classNames('upgrade-btns', {darkMode: this.state.darkMode})}>
                    <div
                        className='button upgrade-button'
                        onClick={() => {
                            window.ipcRenderer.send(this.state.upgradeDownloaded ? START_UPGRADE : START_DOWNLOAD);
                        }}
                    >
                        <i
                            className={'icon-arrow-down-bold-circle-outline'}
                        />
                        {this.state.upgradeAvailable && <div className={'circle'}/>}
                    </div>
                </span>);
        }

        let titleBarButtons;
        if (window.process.platform === 'win32' && !this.props.useNativeWindow) {
            titleBarButtons = (
                <span className='title-bar-btns'>
                    <div
                        className='button min-button'
                        onClick={this.handleMinimize}
                    >
                        <img src={minimizeButton}/>
                    </div>
                    {maxButton}
                    <div
                        className='button close-button'
                        onClick={this.handleClose}
                    >
                        <img src={closeButton}/>
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
        const totalUnreadCount = Object.keys(this.state.unreadCounts).reduce((sum, key) => {
            if (this.state.activeServerName && key.match(serverMatch)) {
                return sum;
            }
            return sum + this.state.unreadCounts[key];
        }, 0);
        const topRow = (
            <Row
                className={topBarClassName}
                onDoubleClick={this.handleDoubleClick}
            >
                <div
                    ref={this.topBar}
                    className={'topBar-bg'}
                >
                    <button
                        className='three-dot-menu'
                        onClick={this.openMenu}
                        tabIndex={0}
                        ref={this.threeDotMenu}
                        aria-label='Context menu'
                    >
                        <DotsVerticalIcon/>
                    </button>
                    <TeamDropdownButton
                        isDisabled={this.state.modalOpen}
                        activeServerName={this.state.activeServerName}
                        totalMentionCount={totalMentionCount}
                        hasUnreads={totalUnreadCount > 0}
                        isMenuOpen={this.state.isMenuOpen}
                        darkMode={this.state.darkMode}
                    />
                    {tabsRow}
                    {upgradeIcon}
                    {titleBarButtons}
                </div>
            </Row>
        );

        const views = () => {
            let component;
            const tabStatus = this.getTabViewStatus();
            if (!tabStatus) {
                if (this.state.activeTabName) {
                    console.error(`Not tabStatus for ${this.state.activeTabName}`);
                } else {
                    console.error('No tab status, tab doesn\'t exist anymore');
                }
                return null;
            }
            switch (tabStatus.status) {
            case Status.NOSERVERS: // TODO: substitute with https://mattermost.atlassian.net/browse/MM-25003
                component = (
                    <ErrorView
                        id={'NoServers'}
                        errorInfo={'No Servers configured'}
                        url={tabStatus.extra ? tabStatus.extra.url : ''}
                        active={true}
                        appName={this.props.appName}
                    />);
                break;
            case Status.FAILED:
                component = (
                    <ErrorView
                        id={this.state.activeTabName + '-fail'}
                        errorInfo={tabStatus.extra?.error}
                        url={tabStatus.extra ? tabStatus.extra.url : ''}
                        active={true}
                        appName={this.props.appName}
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
                        window.ipcRenderer.send(HISTORY, -1);
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
