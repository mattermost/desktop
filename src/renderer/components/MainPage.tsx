// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment} from 'react';
import {Container, Row} from 'react-bootstrap';
import {DropResult} from 'react-beautiful-dnd';
import DotsVerticalIcon from 'mdi-react/DotsVerticalIcon';
import {IpcRendererEvent} from 'electron/renderer';

import {Team} from 'types/config';

import {
    FOCUS_BROWSERVIEW,
    MAXIMIZE_CHANGE,
    DARK_MODE_CHANGE,
    HISTORY,
    LOAD_RETRY,
    LOAD_SUCCESS,
    LOAD_FAILED,
    SHOW_NEW_SERVER_MODAL,
    SWITCH_SERVER,
    WINDOW_CLOSE,
    WINDOW_MINIMIZE,
    WINDOW_RESTORE,
    WINDOW_MAXIMIZE,
    DOUBLE_CLICK_ON_WINDOW,
    PLAY_SOUND,
    MODAL_OPEN,
    MODAL_CLOSE,
    SET_SERVER_KEY,
    UPDATE_MENTIONS,
    TOGGLE_BACK_BUTTON,
    SELECT_NEXT_TAB,
    SELECT_PREVIOUS_TAB,
    ADD_SERVER,
    FOCUS_THREE_DOT_MENU,
    GET_FULL_SCREEN_STATUS,
    CLOSE_TEAMS_DROPDOWN,
    OPEN_TEAMS_DROPDOWN,
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

enum Status {
    LOADING = 1,
    DONE = 2,
    RETRY = -1,
    FAILED = 0,
    NOSERVERS = -2,
}

type Props = {
    teams: Team[];
    showAddServerButton: boolean;
    moveTabs: (originalOrder: number, newOrder: number) => number | undefined;
    openMenu: () => void;
    darkMode: boolean;
    appName: string;
};

type State = {
    key: number;
    sessionsExpired: Record<string, boolean>;
    unreadCounts: Record<string, number>;
    mentionCounts: Record<string, number>;
    targetURL: string;
    maximized: boolean;
    tabStatus: Map<string, TabStatus>;
    darkMode: boolean;
    modalOpen?: boolean;
    fullScreen?: boolean;
    showExtraBar?: boolean;
    isMenuOpen: boolean;
};

type TabStatus = {
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

        this.state = {
            key: this.props.teams.length ? this.props.teams.findIndex((team) => team.order === 0) : 0,
            sessionsExpired: {},
            unreadCounts: {},
            mentionCounts: {},
            targetURL: '',
            maximized: false,
            tabStatus: new Map(this.props.teams.map((server) => [server.name, {status: Status.LOADING}])),
            darkMode: this.props.darkMode,
            isMenuOpen: false,
        };
    }

    getTabStatus() {
        if (this.props.teams.length) {
            const tab = this.props.teams[this.state.key];
            if (tab) {
                const tabname = tab.name;
                return this.state.tabStatus.get(tabname);
            }
        }
        return {status: Status.NOSERVERS};
    }

    updateTabStatus(server: string, newStatusValue: TabStatus) {
        const status = new Map(this.state.tabStatus);
        status.set(server, newStatusValue);
        this.setState({tabStatus: status});
    }

    componentDidMount() {
        // set page on retry
        window.ipcRenderer.on(LOAD_RETRY, (_, server, retry, err, loadUrl) => {
            console.log(`${server}: failed to load ${err}, but retrying`);
            const statusValue = {
                status: Status.RETRY,
                extra: {
                    retry,
                    error: err,
                    url: loadUrl,
                },
            };
            this.updateTabStatus(server, statusValue);
        });

        window.ipcRenderer.on(LOAD_SUCCESS, (_, server) => {
            this.updateTabStatus(server, {status: Status.DONE});
        });

        window.ipcRenderer.on(LOAD_FAILED, (_, server, err, loadUrl) => {
            console.log(`${server}: failed to load ${err}`);
            const statusValue = {
                status: Status.FAILED,
                extra: {
                    error: err,
                    url: loadUrl,
                },
            };
            this.updateTabStatus(server, statusValue);
        });

        window.ipcRenderer.on(DARK_MODE_CHANGE, (_, darkMode) => {
            this.setState({darkMode});
        });

        // can't switch tabs sequentially for some reason...
        window.ipcRenderer.on(SET_SERVER_KEY, (event, key) => {
            const nextIndex = this.props.teams.findIndex((team) => team.order === key);
            this.handleSetServerKey(nextIndex);
        });
        window.ipcRenderer.on(SELECT_NEXT_TAB, () => {
            const currentOrder = this.props.teams[this.state.key].order;
            const nextOrder = ((currentOrder + 1) % this.props.teams.length);
            const nextIndex = this.props.teams.findIndex((team) => team.order === nextOrder);
            const team = this.props.teams[nextIndex];
            this.handleSelect(team.name, nextIndex);
        });

        window.ipcRenderer.on(SELECT_PREVIOUS_TAB, () => {
            const currentOrder = this.props.teams[this.state.key].order;

            // js modulo operator returns a negative number if result is negative, so we have to ensure it's positive
            const nextOrder = ((this.props.teams.length + (currentOrder - 1)) % this.props.teams.length);
            const nextIndex = this.props.teams.findIndex((team) => team.order === nextOrder);
            const team = this.props.teams[nextIndex];
            this.handleSelect(team.name, nextIndex);
        });

        window.ipcRenderer.on(MAXIMIZE_CHANGE, this.handleMaximizeState);

        window.ipcRenderer.on('enter-full-screen', () => this.handleFullScreenState(true));
        window.ipcRenderer.on('leave-full-screen', () => this.handleFullScreenState(false));

        window.ipcRenderer.invoke(GET_FULL_SCREEN_STATUS).then((fullScreenStatus) => this.handleFullScreenState(fullScreenStatus));

        window.ipcRenderer.on(ADD_SERVER, () => {
            this.addServer();
        });

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

        window.ipcRenderer.on(UPDATE_MENTIONS, (_event, team, mentions, unreads, isExpired) => {
            const key = this.props.teams.findIndex((server) => server.name === team);
            const {unreadCounts, mentionCounts, sessionsExpired} = this.state;

            const newMentionCounts = {...mentionCounts};
            newMentionCounts[key] = mentions || 0;

            const newUnreads = {...unreadCounts};
            newUnreads[key] = unreads || false;

            const expired = {...sessionsExpired};
            expired[key] = isExpired || false;

            this.setState({unreadCounts: newUnreads, mentionCounts: newMentionCounts, sessionsExpired: expired});
        });

        window.ipcRenderer.on(CLOSE_TEAMS_DROPDOWN, () => {
            this.setState({isMenuOpen: false});
        });

        window.ipcRenderer.on(OPEN_TEAMS_DROPDOWN, () => {
            this.setState({isMenuOpen: true});
        });

        if (window.process.platform !== 'darwin') {
            window.ipcRenderer.on(FOCUS_THREE_DOT_MENU, () => {
                if (this.threeDotMenu.current) {
                    this.threeDotMenu.current.focus();
                }
            });
        }
    }

    handleMaximizeState = (_: IpcRendererEvent, maximized: boolean) => {
        this.setState({maximized});
    }

    handleFullScreenState = (isFullScreen: boolean) => {
        this.setState({fullScreen: isFullScreen});
    }

    handleSetServerKey = (key: number) => {
        const newKey = ((this.props.teams.length + key) % this.props.teams.length) || 0;
        this.setState({key: newKey});
    }

    handleSelect = (name: string, key: number) => {
        window.ipcRenderer.send(SWITCH_SERVER, name);
        this.handleSetServerKey(key);
    }

    handleDragAndDrop = async (dropResult: DropResult) => {
        const removedIndex = dropResult.source.index;
        const addedIndex = dropResult.destination?.index;
        if (addedIndex === undefined || removedIndex === addedIndex) {
            return;
        }
        const teamIndex = this.props.moveTabs(removedIndex, addedIndex < this.props.teams.length ? addedIndex : this.props.teams.length - 1);
        if (!teamIndex) {
            return;
        }
        const name = this.props.teams[teamIndex].name;
        this.handleSelect(name, teamIndex);
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

    addServer = () => {
        window.ipcRenderer.send(SHOW_NEW_SERVER_MODAL);
    }

    focusOnWebView = () => {
        window.ipcRenderer.send(FOCUS_BROWSERVIEW);
        window.ipcRenderer.send(CLOSE_TEAMS_DROPDOWN);
    }

    render() {
        if (!this.props.teams.length) {
            return null;
        }

        const tabsRow = (
            <TabBar
                id='tabBar'
                isDarkMode={this.state.darkMode}
                teams={this.props.teams}
                sessionsExpired={this.state.sessionsExpired}
                unreadCounts={this.state.unreadCounts}
                mentionCounts={this.state.mentionCounts}
                activeKey={this.state.key}
                onSelect={this.handleSelect}
                onAddServer={this.addServer}
                showAddServerButton={this.props.showAddServerButton}
                onDrop={this.handleDragAndDrop}
                tabsDisabled={this.state.modalOpen}
            />
        );

        let topBarClassName = 'topBar';
        if (window.process.platform === 'darwin') {
            topBarClassName += ' macOS';
        }
        if (this.state.darkMode) {
            topBarClassName += ' darkMode';
        }
        if (this.state.fullScreen) {
            topBarClassName += ' fullScreen';
        }

        let maxButton;
        if (this.state.maximized) {
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

        let overlayGradient;
        if (window.process.platform !== 'darwin') {
            overlayGradient = (
                <span className='overlay-gradient'/>
            );
        }

        let titleBarButtons;
        if (window.os.isWindows10) {
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

        const totalMentionCount = Object.values(this.state.mentionCounts).reduce((sum, value) => sum + value, 0);
        const totalUnreadCount = Object.values(this.state.unreadCounts).reduce((sum, value) => sum + value, 0);
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
                        activeServerName={this.props.teams[this.state.key].name}
                        totalMentionCount={totalMentionCount}
                        hasUnreads={totalUnreadCount > 0}
                        isMenuOpen={this.state.isMenuOpen}
                        darkMode={this.state.darkMode}
                    />
                    {tabsRow}
                    {overlayGradient}
                    {titleBarButtons}
                </div>
            </Row>
        );

        const views = () => {
            let component;
            const tabStatus = this.getTabStatus();
            if (!tabStatus) {
                const tab = this.props.teams[this.state.key];
                if (tab) {
                    console.error(`Not tabStatus for ${this.props.teams[this.state.key].name}`);
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
                        id={this.state.key + '-fail'}
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
