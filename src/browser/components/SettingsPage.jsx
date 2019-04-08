// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses setState().
/* eslint-disable react/no-set-state */

import React from 'react';
import {Button, Checkbox, Col, FormGroup, Grid, HelpBlock, Navbar, Radio, Row} from 'react-bootstrap';

import {ipcRenderer, remote} from 'electron';

import TeamList from './TeamList.jsx';
import AutoSaveIndicator from './AutoSaveIndicator.jsx';

const CONFIG_TYPE_SERVERS = 'servers';
const CONFIG_TYPE_APP_OPTIONS = 'appOptions';

function backToIndex(index) {
  const target = typeof index === 'undefined' ? 0 : index;
  const indexURL = remote.getGlobal('isDev') ? 'http://localhost:8080/browser/index.html' : `file://${remote.app.getAppPath()}/browser/index.html`;
  remote.getCurrentWindow().loadURL(`${indexURL}?index=${target}`);
}

function convertConfigDataToState(configData, currentState = {}) {
  const newState = Object.assign({}, configData);
  newState.showAddTeamForm = false;
  newState.trayWasVisible = currentState.trayWasVisible || remote.getCurrentWindow().trayWasVisible;
  if (newState.teams.length === 0) {
    newState.showAddTeamForm = true;
  }
  newState.savingState = currentState.savingState || {
    appOptions: AutoSaveIndicator.SAVING_STATE_DONE,
    servers: AutoSaveIndicator.SAVING_STATE_DONE,
  };
  return newState;
}

export default class SettingsPage extends React.Component {
  constructor(props) {
    super(props);

    const configData = ipcRenderer.sendSync('get-config-data');

    this.state = convertConfigDataToState(configData);

    this.handleTeamsChange = this.handleTeamsChange.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleChangeShowTrayIcon = this.handleChangeShowTrayIcon.bind(this);
    this.handleChangeTrayIconTheme = this.handleChangeTrayIconTheme.bind(this);
    this.handleChangeAutoStart = this.handleChangeAutoStart.bind(this);
    this.handleChangeMinimizeToTray = this.handleChangeMinimizeToTray.bind(this);
    this.toggleShowTeamForm = this.toggleShowTeamForm.bind(this);
    this.setShowTeamFormVisibility = this.setShowTeamFormVisibility.bind(this);
    this.handleFlashWindow = this.handleFlashWindow.bind(this);
    this.handleBounceIcon = this.handleBounceIcon.bind(this);
    this.handleBounceIconType = this.handleBounceIconType.bind(this);
    this.handleShowUnreadBadge = this.handleShowUnreadBadge.bind(this);
    this.handleChangeUseSpellChecker = this.handleChangeUseSpellChecker.bind(this);
    this.handleChangeEnableHardwareAcceleration = this.handleChangeEnableHardwareAcceleration.bind(this);
    this.updateTeam = this.updateTeam.bind(this);
    this.addServer = this.addServer.bind(this);

    this.trayIconThemeRef = React.createRef();

    this.saveQueue = [];
  }

  componentDidMount() {
    ipcRenderer.on('add-server', () => {
      this.setState({
        showAddTeamForm: true,
      });
    });
    ipcRenderer.on('switch-tab', (event, key) => {
      backToIndex(key);
    });
    ipcRenderer.on('config-updated', (event, data) => {
      this.saveQueue = this.saveQueue.filter((savedItem) => {
        return data[savedItem.key] !== savedItem.data;
      });
      this.updateSaveState();
      this.setState(convertConfigDataToState(data, this.state));
    });
    ipcRenderer.on('config-error', (event, error) => {
      // TODO: Handle config save errors
    });
  }

  saveSetting({key, data}, configType) {
    this.saveQueue.push({
      configType,
      key,
      data,
    });
    this.updateSaveState();
    ipcRenderer.send('update-config', key, data);
  }

  updateSaveState() {
    let queuedServerTypes = 0;
    let queuedAppConfigTypes = 0;
    this.saveQueue.forEach((savedItem) => {
      switch (savedItem.configType) {
      case CONFIG_TYPE_SERVERS:
        queuedServerTypes++;
        break;
      case CONFIG_TYPE_APP_OPTIONS:
        queuedAppConfigTypes++;
        break;
      }
    });
    const savingState = Object.assign({}, this.state.savingState);

    if (queuedServerTypes > 0) {
      savingState[CONFIG_TYPE_SERVERS] = AutoSaveIndicator.SAVING_STATE_SAVING;
    } else if (queuedServerTypes === 0 && savingState[CONFIG_TYPE_SERVERS] === AutoSaveIndicator.SAVING_STATE_SAVING) {
      savingState[CONFIG_TYPE_SERVERS] = AutoSaveIndicator.SAVING_STATE_SAVED;
      // TODO: Need to handle this better
      setTimeout(() => {
        if (this.state.savingState[CONFIG_TYPE_SERVERS] !== AutoSaveIndicator.SAVING_STATE_SAVING) {
          savingState[CONFIG_TYPE_SERVERS] = AutoSaveIndicator.SAVING_STATE_DONE;
          this.setState({savingState});
        }
      }, 2000);
    }

    if (queuedAppConfigTypes > 0) {
      savingState[CONFIG_TYPE_APP_OPTIONS] = AutoSaveIndicator.SAVING_STATE_SAVING;
    } else if (queuedAppConfigTypes === 0 && savingState[CONFIG_TYPE_APP_OPTIONS] === AutoSaveIndicator.SAVING_STATE_SAVING) {
      savingState[CONFIG_TYPE_APP_OPTIONS] = AutoSaveIndicator.SAVING_STATE_SAVED;
      // TODO: Need to handle this better
      setTimeout(() => {
        if (this.state.savingState[CONFIG_TYPE_APP_OPTIONS] !== AutoSaveIndicator.SAVING_STATE_SAVING) {
          savingState[CONFIG_TYPE_APP_OPTIONS] = AutoSaveIndicator.SAVING_STATE_DONE;
          this.setState({savingState});
        }
      }, 2000);
    }

    this.setState({savingState});
  }

  handleTeamsChange(teams) {
    this.saveSetting({key: 'teams', data: teams}, CONFIG_TYPE_SERVERS);
    this.setState({
      showAddTeamForm: false,
      teams,
    });
    if (teams.length === 0) {
      this.setState({showAddTeamForm: true});
    }
  }

  handleCancel() {
    backToIndex();
  }

  handleChangeShowTrayIcon() {
    const shouldShowTrayIcon = !this.refs.showTrayIcon.props.checked;
    this.saveSetting({key: 'showTrayIcon', data: shouldShowTrayIcon}, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      showTrayIcon: shouldShowTrayIcon,
    });

    if (process.platform === 'darwin' && !shouldShowTrayIcon) {
      this.setState({
        minimizeToTray: false,
      });
    }
  }

  handleChangeTrayIconTheme(theme) {
    this.saveSetting({key: 'trayIconTheme', data: theme}, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      trayIconTheme: theme,
    });
  }

  handleChangeAutoStart() {
    this.saveSetting({key: 'autostart', data: !this.refs.autostart.props.checked}, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      autostart: !this.refs.autostart.props.checked,
    });
  }

  handleChangeMinimizeToTray() {
    const shouldMinimizeToTray = this.state.showTrayIcon && !this.refs.minimizeToTray.props.checked;

    this.saveSetting({key: 'minimizeToTray', data: shouldMinimizeToTray}, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      minimizeToTray: shouldMinimizeToTray,
    });
  }

  toggleShowTeamForm() {
    this.setState({
      showAddTeamForm: !this.state.showAddTeamForm,
    });
    document.activeElement.blur();
  }

  setShowTeamFormVisibility(val) {
    this.setState({
      showAddTeamForm: val,
    });
  }

  handleFlashWindow() {
    this.saveSetting({
      key: 'notifications',
      data: {
        ...this.state.notifications,
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2,
      },
    }, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      notifications: {
        ...this.state.notifications,
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2,
      },
    });
  }

  handleBounceIcon() {
    this.saveSetting({
      key: 'notifications',
      data: {
        ...this.state.notifications,
        bounceIcon: !this.refs.bounceIcon.props.checked,
      },
    }, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      notifications: {
        ...this.state.notifications,
        bounceIcon: !this.refs.bounceIcon.props.checked,
      },
    });
  }

  handleBounceIconType(event) {
    this.saveSetting({
      key: 'notifications',
      data: {
        ...this.state.notifications,
        bounceIconType: event.target.value,
      },
    }, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      notifications: {
        ...this.state.notifications,
        bounceIconType: event.target.value,
      },
    });
  }

  handleShowUnreadBadge() {
    this.saveSetting({key: 'showUnreadBadge', data: !this.refs.showUnreadBadge.props.checked}, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      showUnreadBadge: !this.refs.showUnreadBadge.props.checked,
    });
  }

  handleChangeUseSpellChecker() {
    this.saveSetting({key: 'useSpellChecker', data: !this.refs.useSpellChecker.props.checked}, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      useSpellChecker: !this.refs.useSpellChecker.props.checked,
    });
  }

  handleChangeEnableHardwareAcceleration() {
    this.saveSetting({key: 'enableHardwareAcceleration', data: !this.refs.enableHardwareAcceleration.props.checked}, CONFIG_TYPE_APP_OPTIONS);
    this.setState({
      enableHardwareAcceleration: !this.refs.enableHardwareAcceleration.props.checked,
    });
  }

  updateTeam(index, newData) {
    const teams = this.state.teams;
    teams[index] = newData;
    this.saveSetting({key: 'teams', data: teams}, CONFIG_TYPE_SERVERS);
    this.setState({
      teams,
    });
  }

  addServer(team) {
    const teams = this.state.teams;
    teams.push(team);
    this.saveSetting({key: 'teams', data: teams}, CONFIG_TYPE_SERVERS);
    this.setState({
      teams,
    });
  }

  render() {
    const settingsPage = {
      navbar: {
        backgroundColor: '#fff',
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
            allowTeamEdit={this.state.enableTeamModification}
            onTeamClick={(index) => {
              backToIndex(index);
            }}
          />
          {/* <TeamList
            teams={this.state.teams}
            showAddTeamForm={this.state.showAddTeamForm}
            toggleAddTeamForm={this.toggleShowTeamForm}
            setAddTeamFormVisibility={this.setShowTeamFormVisibility}
            onTeamsChange={this.handleTeamsChange}
            updateTeam={this.updateTeam}
            addServer={this.addServer}
            allowTeamEdit={this.state.enableTeamModification}
            onTeamClick={(index) => {
              backToIndex(index + buildConfig.defaultTeams.length);
            }}
          /> */}
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
            >{'⊞ Add new server'}</a>
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
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputAutoStart'
          id='inputAutoStart'
          ref='autostart'
          checked={this.state.autostart}
          onChange={this.handleChangeAutoStart}
        >
          {'Start app on login'}
          <HelpBlock>
            {'If enabled, the app starts automatically when you log in to your machine.'}
            {' '}
            {'The app will initially start minimized and appear on the taskbar.'}
          </HelpBlock>
        </Checkbox>);
    }

    options.push(
      <Checkbox
        key='inputSpellChecker'
        id='inputSpellChecker'
        ref='useSpellChecker'
        checked={this.state.useSpellChecker}
        onChange={this.handleChangeUseSpellChecker}
      >
        {'Check spelling'}
        <HelpBlock>
          {'Highlight misspelled words in your messages.'}
          {' Available for English, French, German, Portuguese, Spanish, and Dutch.'}
        </HelpBlock>
      </Checkbox>);

    if (process.platform === 'darwin' || process.platform === 'win32') {
      const TASKBAR = process.platform === 'win32' ? 'taskbar' : 'Dock';
      options.push(
        <Checkbox
          key='inputShowUnreadBadge'
          id='inputShowUnreadBadge'
          ref='showUnreadBadge'
          checked={this.state.showUnreadBadge}
          onChange={this.handleShowUnreadBadge}
        >
          {`Show red badge on ${TASKBAR} icon to indicate unread messages`}
          <HelpBlock>
            {`Regardless of this setting, mentions are always indicated with a red badge and item count on the ${TASKBAR} icon.`}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='flashWindow'
          id='inputflashWindow'
          ref='flashWindow'
          checked={this.state.notifications.flashWindow === 2}
          onChange={this.handleFlashWindow}
        >
          {'Flash app window and taskbar icon when a new message is received'}
          <HelpBlock>
            {'If enabled, app window and taskbar icon flash for a few seconds when a new message is received.'}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'darwin') {
      options.push(
        <FormGroup>
          <Checkbox
            inline={true}
            key='bounceIcon'
            id='inputBounceIcon'
            ref='bounceIcon'
            checked={this.state.notifications.bounceIcon}
            onChange={this.handleBounceIcon}
            style={{marginRight: '10px'}}
          >
            {'Bounce the Dock icon'}
          </Checkbox>
          <Radio
            inline={true}
            name='bounceIconType'
            value='informational'
            disabled={!this.state.notifications.bounceIcon}
            defaultChecked={
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
            disabled={!this.state.notifications.bounceIcon}
            defaultChecked={this.state.notifications.bounceIconType === 'critical'}
            onChange={this.handleBounceIconType}
          >
            {'until I open the app'}
          </Radio>
          <HelpBlock
            style={{marginLeft: '20px'}}
          >
            {'If enabled, the Dock icon bounces once or until the user opens the app when a new notification is received.'}
          </HelpBlock>
        </FormGroup>
      );
    }

    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputShowTrayIcon'
          id='inputShowTrayIcon'
          ref='showTrayIcon'
          checked={this.state.showTrayIcon}
          onChange={this.handleChangeShowTrayIcon}
        >
          {process.platform === 'darwin' ? `Show ${remote.app.getName()} icon in the menu bar` : 'Show icon in the notification area'}
          <HelpBlock>
            {'Setting takes effect after restarting the app.'}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'linux') {
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
            defaultChecked={this.state.trayIconTheme === 'light' || this.state.trayIconTheme === ''}
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
        </FormGroup>
      );
    }

    if (process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputMinimizeToTray'
          id='inputMinimizeToTray'
          ref='minimizeToTray'
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
        ref='enableHardwareAcceleration'
        checked={this.state.enableHardwareAcceleration}
        onChange={this.handleChangeEnableHardwareAcceleration}
      >
        {'Use GPU hardware acceleration'}
        <HelpBlock>
          {'If enabled, Mattermost UI is rendered more efficiently but can lead to decreased stability for some systems.'}
          {' Setting takes affect after restarting the app.'}
        </HelpBlock>
      </Checkbox>
    );

    const optionsRow = (options.length > 0) ? (
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
          { options.map((opt, i) => (
            <FormGroup key={`fromGroup${i}`}>
              {opt}
            </FormGroup>
          )) }
        </Col>
      </Row>
    ) : null;

    return (
      <div>
        <Navbar
          className='navbar-fixed-top'
          style={settingsPage.navbar}
        >
          <div style={{position: 'relative'}}>
            <h1 style={settingsPage.heading}>{'Settings'}</h1>
            <Button
              id='btnClose'
              className='CloseButton'
              bsStyle='link'
              style={settingsPage.close}
              onClick={this.handleCancel}
              disabled={this.state.teams.length === 0}
            >
              <span>{'×'}</span>
            </Button>
          </div>
        </Navbar>
        <Grid
          className='settingsPage'
          style={{paddingTop: '100px'}}
        >
          { srvMgmt }
          { optionsRow }
        </Grid>
      </div>
    );
  }
}

/* eslint-enable react/no-set-state */
