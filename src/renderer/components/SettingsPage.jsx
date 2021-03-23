// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import 'renderer/css/settings.css';

import React from 'react';
import PropTypes from 'prop-types';
import {Checkbox, Col, FormGroup, Grid, HelpBlock, Navbar, Radio, Row, Button} from 'react-bootstrap';

import {debounce} from 'underscore';

import {GET_LOCAL_CONFIGURATION, UPDATE_CONFIGURATION, DOUBLE_CLICK_ON_WINDOW, GET_DOWNLOAD_LOCATION, SWITCH_SERVER, ADD_SERVER, RELOAD_CONFIGURATION} from 'common/communication';

import TeamList from './TeamList.jsx';
import AutoSaveIndicator from './AutoSaveIndicator.jsx';

const CONFIG_TYPE_SERVERS = 'servers';
const CONFIG_TYPE_APP_OPTIONS = 'appOptions';

function backToIndex(serverName) {
    window.ipcRenderer.send(SWITCH_SERVER, serverName);
    window.close();
}

export default class SettingsPage extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            ready: false,
            teams: [],
            showAddTeamForm: false,
            savingState: {
                appOptions: AutoSaveIndicator.SAVING_STATE_DONE,
                servers: AutoSaveIndicator.SAVING_STATE_DONE,
            },
            userOpenedDownloadDialog: false,
        };

        this.getConfig();
        this.trayIconThemeRef = React.createRef();
        this.downloadLocationRef = React.createRef();
        this.showTrayIconRef = React.createRef();
        this.autostartRef = React.createRef();
        this.minimizeToTrayRef = React.createRef();
        this.flashWindowRef = React.createRef();
        this.bounceIconRef = React.createRef();
        this.showUnreadBadgeRef = React.createRef();
        this.useSpellCheckerRef = React.createRef();
        this.enableHardwareAccelerationRef = React.createRef();

        this.saveQueue = [];
    }

    componentDidMount() {
        window.ipcRenderer.on(ADD_SERVER, () => {
            this.setState({
                showAddTeamForm: true,
            });
        });

        window.ipcRenderer.on(RELOAD_CONFIGURATION, () => {
            this.updateSaveState();
            this.getConfig();
        });
    }

    getConfig = () => {
        window.ipcRenderer.invoke(GET_LOCAL_CONFIGURATION).then((config) => {
            this.setState({ready: true, maximized: false, ...this.convertConfigDataToState(config)});
        });
    }

    convertConfigDataToState = (configData, currentState = {}) => {
        const newState = Object.assign({}, configData);
        newState.showAddTeamForm = currentState.showAddTeamForm || false;
        newState.trayWasVisible = currentState.trayWasVisible || false;
        if (newState.teams.length === 0 && currentState.firstRun !== false) {
            newState.firstRun = false;
            newState.showAddTeamForm = true;
        }
        newState.savingState = currentState.savingState || {
            appOptions: AutoSaveIndicator.SAVING_STATE_DONE,
            servers: AutoSaveIndicator.SAVING_STATE_DONE,
        };
        return newState;
    }

    saveSetting = (configType, {key, data}) => {
        this.saveQueue.push({
            configType,
            key,
            data,
        });
        this.updateSaveState();
        this.processSaveQueue();
    }

    processSaveQueue = debounce(() => {
        window.ipcRenderer.send(UPDATE_CONFIGURATION, this.saveQueue.splice(0, this.saveQueue.length));
    }, 500);

    updateSaveState = () => {
        let queuedUpdateCounts = {
            [CONFIG_TYPE_SERVERS]: 0,
            [CONFIG_TYPE_APP_OPTIONS]: 0,
        };

        queuedUpdateCounts = this.saveQueue.reduce((updateCounts, {configType}) => {
            updateCounts[configType]++;
            return updateCounts;
        }, queuedUpdateCounts);

        const savingState = Object.assign({}, this.state.savingState);

        Object.entries(queuedUpdateCounts).forEach(([configType, count]) => {
            if (count > 0) {
                savingState[configType] = AutoSaveIndicator.SAVING_STATE_SAVING;
            } else if (count === 0 && savingState[configType] === AutoSaveIndicator.SAVING_STATE_SAVING) {
                savingState[configType] = AutoSaveIndicator.SAVING_STATE_SAVED;
                this.resetSaveState(configType);
            }
        });

        this.setState({savingState});
    }

    resetSaveState = debounce((configType) => {
        if (this.state.savingState[configType] !== AutoSaveIndicator.SAVING_STATE_SAVING) {
            const savingState = Object.assign({}, this.state.savingState);
            savingState[configType] = AutoSaveIndicator.SAVING_STATE_DONE;
            this.setState({savingState});
        }
    }, 2000);

    handleTeamsChange = (teams) => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
        this.setState({
            showAddTeamForm: false,
            teams,
        });
        if (teams.length === 0) {
            this.setState({showAddTeamForm: true});
        }
    }

    handleChangeShowTrayIcon = () => {
        const shouldShowTrayIcon = !this.showTrayIconRef.current.props.checked;
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showTrayIcon', data: shouldShowTrayIcon});
        this.setState({
            showTrayIcon: shouldShowTrayIcon,
        });

        if (window.process.platform === 'darwin' && !shouldShowTrayIcon) {
            this.setState({
                minimizeToTray: false,
            });
        }
    }

    handleChangeTrayIconTheme = (theme) => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'trayIconTheme', data: theme});
        this.setState({
            trayIconTheme: theme,
        });
    }

    handleChangeAutoStart = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'autostart', data: !this.autostartRef.current.props.checked});
        this.setState({
            autostart: !this.autostartRef.current.props.checked,
        });
    }

    handleChangeMinimizeToTray = () => {
        const shouldMinimizeToTray = this.state.showTrayIcon && !this.minimizeToTrayRef.current.props.checked;

        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'minimizeToTray', data: shouldMinimizeToTray});
        this.setState({
            minimizeToTray: shouldMinimizeToTray,
        });
    }

    toggleShowTeamForm = () => {
        this.setState({
            showAddTeamForm: !this.state.showAddTeamForm,
        });
        document.activeElement.blur();
    }

    setShowTeamFormVisibility = (val) => {
        this.setState({
            showAddTeamForm: val,
        });
    }

    handleFlashWindow = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
            key: 'notifications',
            data: {
                ...this.state.notifications,
                flashWindow: this.flashWindowRef.current.props.checked ? 0 : 2,
            },
        });
        this.setState({
            notifications: {
                ...this.state.notifications,
                flashWindow: this.flashWindowRef.current.props.checked ? 0 : 2,
            },
        });
    }

    handleBounceIcon = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
            key: 'notifications',
            data: {
                ...this.state.notifications,
                bounceIcon: !this.bounceIconRef.current.props.checked,
            },
        });
        this.setState({
            notifications: {
                ...this.state.notifications,
                bounceIcon: !this.bounceIconRef.current.props.checked,
            },
        });
    }

    handleBounceIconType = (event) => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
            key: 'notifications',
            data: {
                ...this.state.notifications,
                bounceIconType: event.target.value,
            },
        });
        this.setState({
            notifications: {
                ...this.state.notifications,
                bounceIconType: event.target.value,
            },
        });
    }

    handleShowUnreadBadge = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showUnreadBadge', data: !this.showUnreadBadgeRef.current.props.checked});
        this.setState({
            showUnreadBadge: !this.showUnreadBadgeRef.current.props.checked,
        });
    }

    handleChangeUseSpellChecker = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'useSpellChecker', data: !this.useSpellCheckerRef.current.props.checked});
        this.setState({
            useSpellChecker: !this.useSpellCheckerRef.current.props.checked,
        });
    }

    handleChangeEnableHardwareAcceleration = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'enableHardwareAcceleration', data: !this.enableHardwareAccelerationRef.current.props.checked});
        this.setState({
            enableHardwareAcceleration: !this.enableHardwareAccelerationRef.current.props.checked,
        });
    }

    saveDownloadLocation = (location) => {
        this.setState({
            downloadLocation: location,
        });
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'downloadLocation', data: location});
    }

    handleChangeDownloadLocation = (e) => {
        this.saveDownloadLocation(e.target.value);
    }

    selectDownloadLocation = () => {
        if (!this.state.userOpenedDownloadDialog) {
            window.ipcRenderer.invoke(GET_DOWNLOAD_LOCATION, `/Users/${window.process.env.USER || window.process.env.USERNAME}/Downloads`).then((result) => this.saveDownloadLocation(result));
            this.setState({userOpenedDownloadDialog: true});
        }
        this.setState({userOpenedDownloadDialog: false});
    }

    updateTeam = (index, newData) => {
        const teams = this.state.teams;
        teams[index] = newData;
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
        this.setState({
            teams,
        });
    }

    addServer = (team) => {
        const teams = this.state.teams;
        teams.push(team);
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
        this.setState({
            teams,
        });
    }

    openMenu = () => {
        // @eslint-ignore
        this.threeDotMenu.current.blur();
        this.props.openMenu();
    }

    handleDoubleClick = () => {
        window.ipcRenderer.send(DOUBLE_CLICK_ON_WINDOW, 'settings');
    }

    render() {
        const settingsPage = {
            navbar: {
                backgroundColor: '#fff',
                position: 'relative',
            },
            close: {
                textDecoration: 'none',
                position: 'absolute',
                right: '0',
                top: '5px',
                fontSize: '35px',
                fontWeight: 'normal',
                color: '#bbb',
            },
            heading: {
                textAlign: 'center',
                fontSize: '24px',
                margin: '0',
                padding: '1em 0',
            },
            sectionHeading: {
                fontSize: '20px',
                margin: '0',
                padding: '1em 0',
                float: 'left',
            },
            sectionHeadingLink: {
                marginTop: '24px',
                display: 'inline-block',
                fontSize: '15px',
            },
            footer: {
                padding: '0.4em 0',
            },
            downloadLocationInput: {
                marginRight: '3px',
                marginTop: '8px',
                width: '320px',
                height: '34px',
                padding: '0 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontWeight: '500',
            },

            downloadLocationButton: {
                marginBottom: '4px',
            },

            container: {
                paddingBottom: '40px',
            },
        };

        const teamsRow = (
            <Row>
                <Col md={12}>
                    <TeamList
                        teams={this.state.teams}
                        showAddTeamForm={this.state.showAddTeamForm}
                        toggleAddTeamForm={this.toggleShowTeamForm}
                        setAddTeamFormVisibility={this.setShowTeamFormVisibility}
                        onTeamsChange={this.handleTeamsChange}
                        updateTeam={this.updateTeam}
                        addServer={this.addServer}
                        allowTeamEdit={this.state.enableServerManagement}
                        onTeamClick={(name) => {
                            backToIndex(name);
                        }}
                    />
                </Col>
            </Row>
        );

        const serversRow = (
            <Row>
                <Col
                    md={10}
                    xs={8}
                >
                    <h2 style={settingsPage.sectionHeading}>{'Server Management'}</h2>
                    <div className='IndicatorContainer'>
                        <AutoSaveIndicator
                            id='serversSaveIndicator'
                            savingState={this.state.savingState.servers}
                            errorMessage={'Can\'t save your changes. Please try again.'}
                        />
                    </div>
                </Col>
                <Col
                    md={2}
                    xs={4}
                >
                    <p className='text-right'>
                        <a
                            style={settingsPage.sectionHeadingLink}
                            id='addNewServer'
                            href='#'
                            onClick={this.toggleShowTeamForm}
                        >{'+ Add New Server'}</a>
                    </p>
                </Col>
            </Row>
        );

        let srvMgmt;
        if (this.state.enableServerManagement === true) {
            srvMgmt = (
                <div>
                    {serversRow}
                    {teamsRow}
                    <hr/>
                </div>
            );
        }

        const options = [];

        // MacOS has an option in the Dock, to set the app to autostart, so we choose to not support this option for OSX
        if (window.process.platform === 'win32' || window.process.platform === 'linux') {
            options.push(
                <Checkbox
                    key='inputAutoStart'
                    id='inputAutoStart'
                    ref={this.autostartRef}
                    checked={this.state.autostart}
                    onChange={this.handleChangeAutoStart}
                >
                    {'Start app on login'}
                    <HelpBlock>
                        {'If enabled, the app starts automatically when you log in to your machine.'}
                    </HelpBlock>
                </Checkbox>);
        }

        options.push(
            <Checkbox
                key='inputSpellChecker'
                id='inputSpellChecker'
                ref={this.useSpellCheckerRef}
                checked={this.state.useSpellChecker}
                onChange={this.handleChangeUseSpellChecker}
            >
                {'Check spelling'}
                <HelpBlock>
                    {'Highlight misspelled words in your messages.'}
                    {' Available for English, French, German, Portuguese, Spanish, and Dutch.'}
                </HelpBlock>
            </Checkbox>);

        if (window.process.platform === 'darwin' || window.process.platform === 'win32') {
            const TASKBAR = window.process.platform === 'win32' ? 'taskbar' : 'Dock';
            options.push(
                <Checkbox
                    key='inputShowUnreadBadge'
                    id='inputShowUnreadBadge'
                    ref={this.showUnreadBadgeRef}
                    checked={this.state.showUnreadBadge}
                    onChange={this.handleShowUnreadBadge}
                >
                    {`Show red badge on ${TASKBAR} icon to indicate unread messages`}
                    <HelpBlock>
                        {`Regardless of this setting, mentions are always indicated with a red badge and item count on the ${TASKBAR} icon.`}
                    </HelpBlock>
                </Checkbox>);
        }

        if (window.process.platform === 'win32' || window.process.platform === 'linux') {
            options.push(
                <Checkbox
                    key='flashWindow'
                    id='inputflashWindow'
                    ref={this.flashWindowRef}
                    checked={!this.state.notifications || this.state.notifications.flashWindow === 2}
                    onChange={this.handleFlashWindow}
                >
                    {'Flash app window and taskbar icon when a new message is received'}
                    <HelpBlock>
                        {'If enabled, app window and taskbar icon flash for a few seconds when a new message is received.'}
                    </HelpBlock>
                </Checkbox>);
        }

        if (window.process.platform === 'darwin') {
            options.push(
                <FormGroup
                    key='OptionsForm'
                >
                    <Checkbox
                        inline={true}
                        key='bounceIcon'
                        id='inputBounceIcon'
                        ref={this.bounceIconRef}
                        checked={this.state.notifications ? this.state.notifications.bounceIcon : false}
                        onChange={this.handleBounceIcon}
                        style={{marginRight: '10px'}}
                    >
                        {'Bounce the Dock icon'}
                    </Checkbox>
                    <Radio
                        inline={true}
                        name='bounceIconType'
                        value='informational'
                        disabled={!this.state.notifications || !this.state.notifications.bounceIcon}
                        defaultChecked={
                            !this.state.notifications ||
                !this.state.notifications.bounceIconType ||
                this.state.notifications.bounceIconType === 'informational'
                        }
                        onChange={this.handleBounceIconType}
                    >
                        {'once'}
                    </Radio>
                    {' '}
                    <Radio
                        inline={true}
                        name='bounceIconType'
                        value='critical'
                        disabled={!this.state.notifications || !this.state.notifications.bounceIcon}
                        defaultChecked={this.state.notifications && this.state.notifications.bounceIconType === 'critical'}
                        onChange={this.handleBounceIconType}
                    >
                        {'until I open the app'}
                    </Radio>
                    <HelpBlock
                        style={{marginLeft: '20px'}}
                    >
                        {'If enabled, the Dock icon bounces once or until the user opens the app when a new notification is received.'}
                    </HelpBlock>
                </FormGroup>,
            );
        }

        if (window.process.platform === 'darwin' || window.process.platform === 'linux') {
            options.push(
                <Checkbox
                    key='inputShowTrayIcon'
                    id='inputShowTrayIcon'
                    ref={this.showTrayIconRef}
                    checked={this.state.showTrayIcon}
                    onChange={this.handleChangeShowTrayIcon}
                >
                    {window.process.platform === 'darwin' ? `Show ${this.state.appName} icon in the menu bar` : 'Show icon in the notification area'}
                    <HelpBlock>
                        {'Setting takes effect after restarting the app.'}
                    </HelpBlock>
                </Checkbox>);
        }

        if (window.process.platform === 'linux') {
            options.push(
                <FormGroup
                    key='trayIconTheme'
                    ref={this.trayIconThemeRef}
                    style={{marginLeft: '20px'}}
                >
                    {'Icon theme: '}
                    <Radio
                        inline={true}
                        name='trayIconTheme'
                        value='light'
                        defaultChecked={this.state.trayIconTheme === 'light' || !this.state.trayIconTheme}
                        onChange={(event) => this.handleChangeTrayIconTheme('light', event)}
                    >
                        {'Light'}
                    </Radio>
                    {' '}
                    <Radio
                        inline={true}
                        name='trayIconTheme'
                        value='dark'
                        defaultChecked={this.state.trayIconTheme === 'dark'}
                        onChange={(event) => this.handleChangeTrayIconTheme('dark', event)}
                    >{'Dark'}</Radio>
                </FormGroup>,
            );
        }

        if (window.process.platform === 'linux') {
            options.push(
                <Checkbox
                    key='inputMinimizeToTray'
                    id='inputMinimizeToTray'
                    ref={this.minimizeToTrayRef}
                    disabled={!this.state.showTrayIcon || !this.state.trayWasVisible}
                    checked={this.state.minimizeToTray}
                    onChange={this.handleChangeMinimizeToTray}
                >
                    {'Leave app running in notification area when application window is closed'}
                    <HelpBlock>
                        {'If enabled, the app stays running in the notification area after app window is closed.'}
                        {this.state.trayWasVisible || !this.state.showTrayIcon ? '' : ' Setting takes effect after restarting the app.'}
                    </HelpBlock>
                </Checkbox>);
        }

        options.push(
            <Checkbox
                key='inputEnableHardwareAcceleration'
                id='inputEnableHardwareAcceleration'
                ref={this.enableHardwareAccelerationRef}
                checked={this.state.enableHardwareAcceleration}
                onChange={this.handleChangeEnableHardwareAcceleration}
            >
                {'Use GPU hardware acceleration'}
                <HelpBlock>
                    {'If enabled, Mattermost UI is rendered more efficiently but can lead to decreased stability for some systems.'}
                    {' Setting takes effect after restarting the app.'}
                </HelpBlock>
            </Checkbox>,
        );

        options.push(
            <div style={settingsPage.container}>
                <hr/>
                <div>{'Download Location'}</div>
                <input
                    disabled={true}
                    style={settingsPage.downloadLocationInput}
                    key='inputDownloadLocation'
                    id='inputDownloadLocation'
                    ref={this.downloadLocationRef}
                    onChange={this.handleChangeDownloadLocation}
                    value={this.state.downloadLocation}
                />
                <Button
                    style={settingsPage.downloadLocationButton}
                    id='saveDownloadLocation'
                    onClick={this.selectDownloadLocation}
                >
                    <span>{'Change'}</span>
                </Button>
                <HelpBlock>
                    {'Specify the folder where files will download.'}
                </HelpBlock>
            </div>,
        );

        let optionsRow = null;
        if (options.length > 0) {
            optionsRow = (
                <Row>
                    <Col md={12}>
                        <h2 style={settingsPage.sectionHeading}>{'App Options'}</h2>
                        <div className='IndicatorContainer'>
                            <AutoSaveIndicator
                                id='appOptionsSaveIndicator'
                                savingState={this.state.savingState.appOptions}
                                errorMessage={'Can\'t save your changes. Please try again.'}
                            />
                        </div>
                        { options.map((opt) => (
                            <FormGroup key={opt.key}>
                                {opt}
                            </FormGroup>
                        )) }
                    </Col>
                </Row>
            );
        }

        let waitForIpc;
        if (this.state.ready) {
            waitForIpc = (
                <>
                    {srvMgmt}
                    {optionsRow}
                </>
            );
        } else {
            waitForIpc = (<p>{'Loading configuration...'}</p>);
        }

        return (
            <div
                className='container-fluid'
                style={{
                    height: '100%',
                }}
            >
                <div
                    style={{
                        overflowY: 'auto',
                        height: '100%',
                        margin: '0 -15px',
                    }}
                >
                    <Navbar
                        className='navbar-fixed-top'
                        style={settingsPage.navbar}
                    >
                        <div style={{position: 'relative'}}>
                            <h1 style={settingsPage.heading}>{'Settings'}</h1>
                        </div>
                    </Navbar>
                    <Grid
                        className='settingsPage'
                    >
                        {waitForIpc}
                    </Grid>
                </div>
            </div>
        );
    }
}

SettingsPage.propTypes = {
    openMenu: PropTypes.func.isRequired,
};
