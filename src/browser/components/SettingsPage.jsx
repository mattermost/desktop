const React = require('react');
const PropTypes = require('prop-types');
const createReactClass = require('create-react-class');
const ReactDOM = require('react-dom');
const {Button, Checkbox, Col, FormGroup, Grid, HelpBlock, Navbar, Radio, Row} = require('react-bootstrap');

const {ipcRenderer, remote} = require('electron');
const AutoLaunch = require('auto-launch');
const {debounce} = require('underscore');

const settings = require('../../common/settings');
const appName = require('../../package.json').productName;

const TeamList = require('./TeamList.jsx');
const AutoSaveIndicator = require('./AutoSaveIndicator.jsx');

const appLauncher = new AutoLaunch({
  name: appName,
  isHidden: true
});

function backToIndex(index) {
  const target = typeof index === 'undefined' ? 0 : index;
  const indexURL = remote.getGlobal('isDev') ? 'http://localhost:8080/browser/index.html' : `file://${remote.app.getAppPath()}/browser/index.html`;
  remote.getCurrentWindow().loadURL(`${indexURL}?index=${target}`);
}

const SettingsPage = createReactClass({
  propTypes: {
    configFile: PropTypes.string
  },

  getInitialState() {
    var initialState;
    try {
      initialState = settings.readFileSync(this.props.configFile);
    } catch (e) {
      initialState = settings.loadDefault();
    }

    initialState.showAddTeamForm = false;
    initialState.trayWasVisible = remote.getCurrentWindow().trayWasVisible;
    if (initialState.teams.length === 0) {
      initialState.showAddTeamForm = true;
    }
    initialState.savingState = 'done';

    return initialState;
  },
  componentDidMount() {
    if (process.platform === 'win32' || process.platform === 'linux') {
      var self = this;
      appLauncher.isEnabled().then((enabled) => {
        self.setState({
          autostart: enabled
        });
      });
    }
    ipcRenderer.on('add-server', () => {
      this.setState({
        showAddTeamForm: true
      });
    });
    ipcRenderer.on('switch-tab', (event, key) => {
      backToIndex(key);
    });
  },

  setSavingState(state) {
    if (!this.setSavingStateSaved) {
      this.setSavingStateSaved = debounce(() => {
        this.saveConfig((err) => {
          if (err) {
            this.setState({savingState: 'error'});
          } else {
            this.setState({savingState: 'saved'});
          }
          this.setSavingStateDoneTimer = setTimeout(this.setState.bind(this, {savingState: 'done'}), 2000);
        });
      }, 500);
    }
    if (this.setSavingStateDoneTimer) {
      clearTimeout(this.setSavingStateDoneTimer);
      this.setSavingStateDoneTimer = null;
    }
    this.setState({savingState: state});
    if (state === 'saving') {
      this.setSavingStateSaved();
    }
  },

  startSaveConfig() {
    this.setSavingState('saving');
  },

  handleTeamsChange(teams) {
    this.setState({
      showAddTeamForm: false,
      teams
    });
    if (teams.length === 0) {
      this.setState({showAddTeamForm: true});
    }
    setImmediate(this.startSaveConfig);
  },

  saveConfig(callback) {
    var config = {
      teams: this.state.teams,
      showTrayIcon: this.state.showTrayIcon,
      trayIconTheme: this.state.trayIconTheme,
      version: settings.version,
      minimizeToTray: this.state.minimizeToTray,
      notifications: {
        flashWindow: this.state.notifications.flashWindow
      },
      showUnreadBadge: this.state.showUnreadBadge,
      useSpellChecker: this.state.useSpellChecker,
      spellCheckerLocale: this.state.spellCheckerLocale
    };

    settings.writeFile(this.props.configFile, config, (err) => {
      if (err) {
        callback(err);
        return;
      }
      ipcRenderer.send('update-menu', config);
      ipcRenderer.send('update-config');
      if (process.platform === 'win32' || process.platform === 'linux') {
        const autostart = this.state.autostart;
        this.saveAutoStart(autostart, callback);
      } else {
        callback();
      }
    });
  },

  saveAutoStart(autostart, callback) {
    appLauncher.isEnabled().then((enabled) => {
      if (enabled && !autostart) {
        appLauncher.disable().then(() => {
          callback();
        }).catch(callback);
      } else if (!enabled && autostart) {
        appLauncher.enable().then(() => {
          callback();
        }).catch(callback);
      } else {
        callback();
      }
    }).catch(callback);
  },

  handleCancel() {
    backToIndex();
  },
  handleChangeShowTrayIcon() {
    var shouldShowTrayIcon = !this.refs.showTrayIcon.props.checked;
    this.setState({
      showTrayIcon: shouldShowTrayIcon
    });

    if (process.platform === 'darwin' && !shouldShowTrayIcon) {
      this.setState({
        minimizeToTray: false
      });
    }

    setImmediate(this.startSaveConfig);
  },
  handleChangeTrayIconTheme() {
    this.setState({
      trayIconTheme: ReactDOM.findDOMNode(this.refs.trayIconTheme).value
    });
    setImmediate(this.startSaveConfig);
  },
  handleChangeAutoStart() {
    this.setState({
      autostart: !this.refs.autostart.props.checked
    });
    setImmediate(this.startSaveConfig);
  },
  handleChangeMinimizeToTray() {
    const shouldMinimizeToTray = this.state.showTrayIcon && !this.refs.minimizeToTray.props.checked;

    this.setState({
      minimizeToTray: shouldMinimizeToTray
    });
    setImmediate(this.startSaveConfig);
  },
  toggleShowTeamForm() {
    this.setState({
      showAddTeamForm: !this.state.showAddTeamForm
    });
  },
  setShowTeamFormVisibility(val) {
    this.setState({
      showAddTeamForm: val
    });
  },
  handleFlashWindow() {
    this.setState({
      notifications: {
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2
      }
    });
    setImmediate(this.startSaveConfig);
  },
  handleShowUnreadBadge() {
    this.setState({
      showUnreadBadge: !this.refs.showUnreadBadge.props.checked
    });
    setImmediate(this.startSaveConfig);
  },

  handleChangeUseSpellChecker() {
    this.setState({
      useSpellChecker: !this.refs.useSpellChecker.props.checked
    });
    setImmediate(this.startSaveConfig);
  },

  updateTeam(index, newData) {
    var teams = this.state.teams;
    teams[index] = newData;
    this.setState({
      teams
    });
    setImmediate(this.startSaveConfig);
  },

  addServer(team) {
    var teams = this.state.teams;
    teams.push(team);
    this.setState({
      teams
    });
    setImmediate(this.startSaveConfig);
  },

  render() {
    var teamsRow = (
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
            onTeamClick={backToIndex}
          />
        </Col>
      </Row>
    );

    var options = [];

    // MacOS has an option in the Dock, to set the app to autostart, so we choose to not support this option for OSX
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputAutoStart'
          id='inputAutoStart'
          ref='autostart'
          checked={this.state.autostart}
          onChange={this.handleChangeAutoStart}
        >{'Start app on login'}
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
          {' Available for English, French, German, Spanish, and Dutch.'}
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
        >{`Show red badge on ${TASKBAR} icon to indicate unread messages`}
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
        >{'Flash app window and taskbar icon when a new message is received'}
          <HelpBlock>
            {'If enabled, app window and taskbar icon flash for a few seconds when a new message is received.'}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputShowTrayIcon'
          id='inputShowTrayIcon'
          ref='showTrayIcon'
          checked={this.state.showTrayIcon}
          onChange={this.handleChangeShowTrayIcon}
        >{process.platform === 'darwin' ?
          'Show Mattermost icon in the menu bar' :
          'Show icon in the notification area'}
          <HelpBlock>
            {'Setting takes effect after restarting the app.'}
          </HelpBlock>
        </Checkbox>);
    }
    if (process.platform === 'linux') {
      options.push(
        <FormGroup
          key='trayIconTheme'
          style={{marginLeft: '20px'}}
        >
          {'Icon theme: '}
          <Radio
            inline={true}
            name='trayIconTheme'
            value='light'
            defaultChecked={this.state.trayIconTheme === 'light' || this.state.trayIconTheme === ''}
            onChange={() => {
              this.setState({trayIconTheme: 'light'});
              setImmediate(this.startSaveConfig);
            }}
          >{'Light'}</Radio>
          {' '}
          <Radio
            inline={true}
            name='trayIconTheme'
            value='dark'
            defaultChecked={this.state.trayIconTheme === 'dark'}
            onChange={() => {
              this.setState({trayIconTheme: 'dark'});
              setImmediate(this.startSaveConfig);
            }}
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

    const settingsPage = {
      navbar: {
        backgroundColor: '#fff'
      },
      close: {
        textDecoration: 'none',
        position: 'absolute',
        right: '0',
        top: '5px',
        fontSize: '35px',
        fontWeight: 'normal',
        color: '#bbb'
      },
      heading: {
        textAlign: 'center',
        fontSize: '24px',
        margin: '0',
        padding: '1em 0'
      },
      sectionHeading: {
        fontSize: '20px',
        margin: '0',
        padding: '1em 0'
      },
      sectionHeadingLink: {
        marginTop: '24px',
        display: 'inline-block',
        fontSize: '15px'
      },
      footer: {
        padding: '0.4em 0'
      }
    };

    var optionsRow = (options.length > 0) ? (
      <Row>
        <Col md={12}>
          <h2 style={settingsPage.sectionHeading}>{'App Options'}</h2>
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
          <div className='IndicatorContainer'>
            <AutoSaveIndicator
              savingState={this.state.savingState}
              errorMessage={'Can\'t save your changes. Please try again.'}
            />
          </div>
          <div style={{position: 'relative'}}>
            <h1 style={settingsPage.heading}>{'Settings'}</h1>
            <Button
              id='btnClose'
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
          <Row>
            <Col
              md={10}
              xs={8}
            >
              <h2 style={settingsPage.sectionHeading}>{'Server Management'}</h2>
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
          { teamsRow }
          <hr/>
          { optionsRow }
        </Grid>
      </div>
    );
  }
});

module.exports = SettingsPage;
