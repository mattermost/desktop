// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses setState().
/* eslint-disable react/no-set-state */

import os from 'os';

import React from 'react';
import PropTypes from 'prop-types';
import {Button, Checkbox, Col, FormGroup, Grid, HelpBlock, Navbar, Radio, Row} from 'react-bootstrap';

import {ipcRenderer, remote} from 'electron';
import {debounce} from 'underscore';
import DotsVerticalIcon from 'mdi-react/DotsVerticalIcon';

import Config from '../../common/config';

import restoreButton from '../../assets/titlebar/chrome-restore.svg';
import maximizeButton from '../../assets/titlebar/chrome-maximize.svg';
import minimizeButton from '../../assets/titlebar/chrome-minimize.svg';
import closeButton from '../../assets/titlebar/chrome-close.svg';

import TeamList from './TeamList.jsx';
import AutoSaveIndicator from './AutoSaveIndicator.jsx';
import TabBar from './TabBar.jsx';

const CONFIG_TYPE_SERVERS = 'servers';
const CONFIG_TYPE_APP_OPTIONS = 'appOptions';

const config = new Config(remote.app.getPath('userData') + '/config.json', remote.getCurrentWindow().registryConfigData);

function backToIndex(index) {
  const target = typeof index === 'undefined' ? 0 : index;
  const indexURL = remote.getGlobal('isDev') ? 'http://localhost:8080/browser/index.html' : `file://${remote.app.getAppPath()}/browser/index.html`;
  remote.getCurrentWindow().loadURL(`${indexURL}?index=${target}`);
}

export default class SettingsPage extends React.Component {
  constructor(props) {
    super(props);

    this.state = this.convertConfigDataToState(config.data);
    this.setState({
      maximized: false,
    });

    this.trayIconThemeRef = React.createRef();

    this.saveQueue = [];
  }

  getTabWebContents() {
    return remote.webContents.getFocusedWebContents();
  }

  componentDidMount() {
    const self = this;
    config.on('update', (configData) => {
      this.updateSaveState();
      this.setState(this.convertConfigDataToState(configData, this.state));
    });

    config.on('error', (error) => {
      console.log('Config saving error: ', error);

      const savingState = Object.assign({}, this.state.savingState);
      Object.entries(savingState).forEach(([configType, currentState]) => {
        if (currentState !== AutoSaveIndicator.SAVING_STATE_DONE) {
          savingState[configType] = AutoSaveIndicator.SAVING_STATE_ERROR;
          this.setState({savingState});
        }
      });
    });

    function focusListener() {
      self.setState({unfocused: false});
    }

    function blurListener() {
      self.setState({unfocused: true});
    }

    const currentWindow = remote.getCurrentWindow();
    currentWindow.on('focus', focusListener);
    currentWindow.on('blur', blurListener);
    if (currentWindow.isMaximized()) {
      self.setState({maximized: true});
    }
    currentWindow.on('maximize', this.handleMaximizeState);
    currentWindow.on('unmaximize', this.handleMaximizeState);

    if (currentWindow.isFullScreen()) {
      self.setState({fullScreen: true});
    }
    currentWindow.on('enter-full-screen', this.handleFullScreenState);
    currentWindow.on('leave-full-screen', this.handleFullScreenState);

    // when the config object changes here in the renderer process, tell the main process to reload its config object to get the changes
    config.on('synchronize', () => {
      ipcRenderer.send('reload-config');
    });

    // listen for any config reload requests from the main process to reload configuration changes here in the renderer process
    ipcRenderer.on('reload-config', () => {
      config.reload();
    });

    ipcRenderer.on('add-server', () => {
      this.setState({
        showAddTeamForm: true,
      });
    });

    ipcRenderer.on('switch-tab', (event, key) => {
      backToIndex(key);
    });

    ipcRenderer.on('zoom-in', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      if (activeTabWebContents.zoomLevel >= 9) {
        return;
      }
      activeTabWebContents.zoomLevel += 1;
    });

    ipcRenderer.on('zoom-out', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      if (activeTabWebContents.zoomLevel <= -8) {
        return;
      }
      activeTabWebContents.zoomLevel -= 1;
    });

    ipcRenderer.on('zoom-reset', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.zoomLevel = 0;
    });

    ipcRenderer.on('undo', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.undo();
    });

    ipcRenderer.on('redo', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.redo();
    });

    ipcRenderer.on('cut', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.cut();
    });

    ipcRenderer.on('copy', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.copy();
    });

    ipcRenderer.on('paste', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.paste();
    });

    ipcRenderer.on('paste-and-match', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.pasteAndMatchStyle();
    });

    if (process.platform === 'darwin') {
      self.setState({
        isDarkMode: remote.nativeTheme.shouldUseDarkColors,
      });
      remote.systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
        self.setState({
          isDarkMode: remote.nativeTheme.shouldUseDarkColors,
        });
      });
    } else {
      self.setState({
        isDarkMode: this.props.getDarkMode(),
      });

      ipcRenderer.on('set-dark-mode', () => {
        this.setDarkMode();
      });

      this.threeDotMenu = React.createRef();
      ipcRenderer.on('focus-three-dot-menu', () => {
        if (this.threeDotMenu.current) {
          this.threeDotMenu.current.focus();
        }
      });
    }
  }

  convertConfigDataToState = (configData, currentState = {}) => {
    const newState = Object.assign({}, configData);
    newState.showAddTeamForm = currentState.showAddTeamForm || false;
    newState.trayWasVisible = currentState.trayWasVisible || remote.getCurrentWindow().trayWasVisible;
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
    config.setMultiple(this.saveQueue.splice(0, this.saveQueue.length));
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
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      showAddTeamForm: false,
      teams,
    });
    if (teams.length === 0) {
      this.setState({showAddTeamForm: true});
    }
  }

  handleCancel = () => {
    backToIndex();
  }

  handleChangeShowTrayIcon = () => {
    const shouldShowTrayIcon = !this.refs.showTrayIcon.props.checked;
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showTrayIcon', data: shouldShowTrayIcon});
    this.setState({
      showTrayIcon: shouldShowTrayIcon,
    });

    if (process.platform === 'darwin' && !shouldShowTrayIcon) {
      this.setState({
        minimizeToTray: false,
      });
    }
  }

  handleChangeTrayIconTheme = (theme) => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'trayIconTheme', data: theme});
    this.setState({
      trayIconTheme: theme,
    });
  }

  handleChangeAutoStart = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'autostart', data: !this.refs.autostart.props.checked});
    this.setState({
      autostart: !this.refs.autostart.props.checked,
    });
  }

  handleChangeMinimizeToTray = () => {
    const shouldMinimizeToTray = this.state.showTrayIcon && !this.refs.minimizeToTray.props.checked;

    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'minimizeToTray', data: shouldMinimizeToTray});
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
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
      key: 'notifications',
      data: {
        ...this.state.notifications,
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2,
      },
    });
    this.setState({
      notifications: {
        ...this.state.notifications,
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2,
      },
    });
  }

  handleBounceIcon = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
      key: 'notifications',
      data: {
        ...this.state.notifications,
        bounceIcon: !this.refs.bounceIcon.props.checked,
      },
    });
    this.setState({
      notifications: {
        ...this.state.notifications,
        bounceIcon: !this.refs.bounceIcon.props.checked,
      },
    });
  }

  handleBounceIconType = (event) => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
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
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showUnreadBadge', data: !this.refs.showUnreadBadge.props.checked});
    this.setState({
      showUnreadBadge: !this.refs.showUnreadBadge.props.checked,
    });
  }

  handleChangeUseSpellChecker = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'useSpellChecker', data: !this.refs.useSpellChecker.props.checked});
    this.setState({
      useSpellChecker: !this.refs.useSpellChecker.props.checked,
    });
  }

  handleChangeEnableHardwareAcceleration = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'enableHardwareAcceleration', data: !this.refs.enableHardwareAcceleration.props.checked});
    this.setState({
      enableHardwareAcceleration: !this.refs.enableHardwareAcceleration.props.checked,
    });
  }

  updateTeam = (index, newData) => {
    const teams = this.state.localTeams;
    teams[index] = newData;
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      teams,
    });
  }

  addServer = (team) => {
    const teams = this.state.localTeams;
    teams.push(team);
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      teams,
    });
  }

  setDarkMode() {
    this.setState({
      isDarkMode: this.props.setDarkMode(),
    });
  }

  handleClose = () => {
    const win = remote.getCurrentWindow();
    win.close();
  }

  handleMinimize = () => {
    const win = remote.getCurrentWindow();
    win.minimize();
  }

  handleMaximize = () => {
    const win = remote.getCurrentWindow();
    win.maximize();
  }

  handleRestore = () => {
    const win = remote.getCurrentWindow();
    win.restore();
  }

  openMenu = () => {
    // @eslint-ignore
    this.threeDotMenu.current.blur();
    this.props.openMenu();
  }

  handleDoubleClick = () => {
    if (process.platform === 'darwin') {
      const doubleClickAction = remote.systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
      const win = remote.getCurrentWindow();
      if (doubleClickAction === 'Minimize') {
        win.minimize();
      } else if (!win.isMaximized()) {
        win.maximize();
      } else if (win.isMaximized()) {
        win.unmaximize();
      }
    }
  }

  handleMaximizeState = () => {
    const win = remote.getCurrentWindow();
    this.setState({maximized: win.isMaximized()});
  }

  handleFullScreenState = () => {
    const win = remote.getCurrentWindow();
    this.setState({fullScreen: win.isFullScreen()});
  }

  render() {
    const tabsRow = (
      <TabBar
        id='tabBar'
        isDarkMode={this.state.isDarkMode}
        teams={[]}
        showAddServerButton={false}
      />
    );

    let topBarClassName = 'topBar';
    if (process.platform === 'darwin') {
      topBarClassName += ' macOS';
    }
    if (this.state.isDarkMode) {
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
    if (process.platform !== 'darwin') {
      overlayGradient = (
        <span className='overlay-gradient'/>
      );
    }

    let titleBarButtons;
    if (os.platform() === 'win32' && os.release().startsWith('10')) {
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

    const topRow = (
      <Row
        className={topBarClassName}
        onDoubleClick={this.handleDoubleClick}
      >
        <div
          ref={this.topBar}
          className={`topBar-bg${this.state.unfocused ? ' unfocused' : ''}`}
        >
          <button
            className='three-dot-menu'
            onClick={this.openMenu}
            tabIndex={0}
            ref={this.threeDotMenu}
          >
            <DotsVerticalIcon/>
          </button>
          {tabsRow}
          {overlayGradient}
          {titleBarButtons}
        </div>
      </Row>
    );

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
    };

    const teamsRow = (
      <Row>
        <Col md={12}>
          <TeamList
            teams={this.state.localTeams}
            showAddTeamForm={this.state.showAddTeamForm}
            toggleAddTeamForm={this.toggleShowTeamForm}
            setAddTeamFormVisibility={this.setShowTeamFormVisibility}
            onTeamsChange={this.handleTeamsChange}
            updateTeam={this.updateTeam}
            addServer={this.addServer}
            allowTeamEdit={this.state.enableTeamModification}
            onTeamClick={(index) => {
              backToIndex(this.state.localTeams[index].order + this.state.buildTeams.length + this.state.registryTeams.length);
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
          {' Available for English, French, German, Portuguese, Russian, Ukrainian, Spanish, and Dutch.'}
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
          {process.platform === 'darwin' ? `Show ${remote.app.name} icon in the menu bar` : 'Show icon in the notification area'}
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
          {' Setting takes effect after restarting the app.'}
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
      <div
        className='container-fluid'
        style={{
          height: '100%',
        }}
      >
        { topRow }
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
          >
            { srvMgmt }
            { optionsRow }
          </Grid>
        </div>
      </div>
    );
  }
}

SettingsPage.propTypes = {
  getDarkMode: PropTypes.func.isRequired,
  setDarkMode: PropTypes.func.isRequired,
  openMenu: PropTypes.func.isRequired,
};

/* eslint-enable react/no-set-state */
