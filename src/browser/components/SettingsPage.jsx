const React = require('react');
const ReactDOM = require('react-dom');
const {Button, Checkbox, Col, FormGroup, FormControl, ControlLabel, Grid, Navbar, Row} = require('react-bootstrap');

const {ipcRenderer, remote} = require('electron');
const AutoLaunch = require('auto-launch');

const settings = require('../../common/settings');

const TeamList = require('./TeamList.jsx');

const appLauncher = new AutoLaunch({
  name: 'Mattermost',
  isHidden: true
});

function backToIndex() {
  remote.getCurrentWindow().loadURL('file://' + __dirname + '/index.html');
}

const SettingsPage = React.createClass({
  propTypes: {
    configFile: React.PropTypes.string
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
  },
  handleTeamsChange(teams) {
    this.setState({
      showAddTeamForm: false,
      teams
    });
  },
  handleSave() {
    var config = {
      teams: this.state.teams,
      hideMenuBar: this.state.hideMenuBar,
      showTrayIcon: this.state.showTrayIcon,
      trayIconTheme: this.state.trayIconTheme,
      disablewebsecurity: this.state.disablewebsecurity,
      version: settings.version,
      minimizeToTray: this.state.minimizeToTray,
      toggleWindowOnTrayIconClick: this.state.toggleWindowOnTrayIconClick,
      notifications: {
        flashWindow: this.state.notifications.flashWindow
      },
      showUnreadBadge: this.state.showUnreadBadge
    };
    settings.writeFileSync(this.props.configFile, config);
    if (process.platform === 'win32' || process.platform === 'linux') {
      var currentWindow = remote.getCurrentWindow();
      currentWindow.setAutoHideMenuBar(config.hideMenuBar);
      currentWindow.setMenuBarVisibility(!config.hideMenuBar);

      var autostart = this.state.autostart;
      appLauncher.isEnabled().then((enabled) => {
        if (enabled && !autostart) {
          appLauncher.disable();
        } else if (!enabled && autostart) {
          appLauncher.enable();
        }
      });
    }

    ipcRenderer.send('update-menu', config);
    ipcRenderer.send('update-config');

    backToIndex();
  },
  handleCancel() {
    backToIndex();
  },
  handleChangeDisableWebSecurity() {
    this.setState({
      disablewebsecurity: !this.refs.disablewebsecurity.props.checked
    });
  },
  handleChangeHideMenuBar() {
    this.setState({
      hideMenuBar: !this.refs.hideMenuBar.props.checked
    });
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
  },
  handleChangeTrayIconTheme() {
    this.setState({
      trayIconTheme: ReactDOM.findDOMNode(this.refs.trayIconTheme).value
    });
  },
  handleChangeAutoStart() {
    this.setState({
      autostart: !this.refs.autostart.props.checked
    });
  },
  handleChangeMinimizeToTray() {
    const shouldMinimizeToTray = this.state.showTrayIcon && !this.refs.minimizeToTray.props.checked;

    this.setState({
      minimizeToTray: shouldMinimizeToTray
    });
  },
  handleChangeToggleWindowOnTrayIconClick() {
    this.setState({
      toggleWindowOnTrayIconClick: !this.refs.toggleWindowOnTrayIconClick.props.checked
    });
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
  },
  handleShowUnreadBadge() {
    this.setState({
      showUnreadBadge: !this.refs.showUnreadBadge.props.checked
    });
  },

  updateTeam(index, newData) {
    var teams = this.state.teams;
    teams[index] = newData;
    this.setState({
      teams
    });
  },

  addServer(team) {
    var teams = this.state.teams;
    teams.push(team);
    this.setState({
      teams
    });
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
          />
        </Col>
      </Row>
    );

    var options = [];
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputHideMenuBar'
          id='inputHideMenuBar'
          ref='hideMenuBar'
          checked={this.state.hideMenuBar}
          onChange={this.handleChangeHideMenuBar}
        >{'Hide menu bar (Press Alt to show menu bar)'}</Checkbox>);
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
          'Show icon on menu bar (need to restart the application)' :
          'Show icon in notification area (need to restart the application)'}</Checkbox>);
    }
    if (process.platform === 'linux') {
      options.push(
        <FormGroup>
          <ControlLabel>{'Icon theme (Need to restart the application)'}</ControlLabel>
          <FormControl
            componentClass='select'
            key='inputTrayIconTheme'
            ref='trayIconTheme'
            value={this.state.trayIconTheme}
            onChange={this.handleChangeTrayIconTheme}
          >
            <option value='light'>{'Light'}</option>
            <option value='dark'>{'Dark'}</option>
          </FormControl>
        </FormGroup>);
    }
    options.push(
      <Checkbox
        key='inputDisableWebSecurity'
        id='inputDisableWebSecurity'
        ref='disablewebsecurity'
        checked={this.state.disablewebsecurity}
        onChange={this.handleChangeDisableWebSecurity}
      >{'Allow mixed content (Enabling allows both secure and insecure content, images and scripts to render and execute. Disabling allows only secure content.)'}</Checkbox>);

    //OSX has an option in the Dock, to set the app to autostart, so we choose to not support this option for OSX
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputAutoStart'
          id='inputAutoStart'
          ref='autostart'
          checked={this.state.autostart}
          onChange={this.handleChangeAutoStart}
        >{'Start app on login.'}</Checkbox>);
    }

    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputMinimizeToTray'
          id='inputMinimizeToTray'
          ref='minimizeToTray'
          disabled={!this.state.showTrayIcon || !this.state.trayWasVisible}
          checked={this.state.minimizeToTray}
          onChange={this.handleChangeMinimizeToTray}
        >{this.state.trayWasVisible || !this.state.showTrayIcon ? 'Leave app running in notification area when the window is closed' : 'Leave app running in notification area when the window is closed (available on next restart)'}</Checkbox>);
    }

    if (process.platform === 'win32') {
      options.push(
        <Checkbox
          key='inputToggleWindowOnTrayIconClick'
          id='inputToggleWindowOnTrayIconClick'
          ref='toggleWindowOnTrayIconClick'
          checked={this.state.toggleWindowOnTrayIconClick}
          onChange={this.handleChangeToggleWindowOnTrayIconClick}
        >{'Toggle window visibility when clicking on the tray icon.'}</Checkbox>);
    }

    if (process.platform === 'darwin' || process.platform === 'win32') {
      options.push(
        <Checkbox
          key='inputShowUnreadBadge'
          id='inputShowUnreadBadge'
          ref='showUnreadBadge'
          checked={this.state.showUnreadBadge}
          onChange={this.handleShowUnreadBadge}
        >{'Show red badge on taskbar icon to indicate unread messages. Regardless of this setting, mentions are always indicated with a red badge and item count on the taskbar icon.'}</Checkbox>);
    }

    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='flashWindow'
          id='inputflashWindow'
          ref='flashWindow'
          checked={this.state.notifications.flashWindow === 2}
          onChange={this.handleFlashWindow}
        >{'Flash the taskbar icon when a new message is received.'}</Checkbox>);
    }

    const settingsPage = {
      navbar: {
        backgroundColor: '#fff'
      },
      close: {
        position: 'absolute',
        right: '0',
        top: '10px',
        fontSize: '35px',
        fontWeight: 'normal',
        color: '#bbb',
        cursor: 'pointer'
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
          <h2 style={settingsPage.sectionHeading}>{'App options'}</h2>
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
            <div
              style={settingsPage.close}
              onClick={this.handleCancel}
            >
              <span>{'×'}</span>
            </div>
          </div>
        </Navbar>
        <Grid
          className='settingsPage'
          style={{padding: '100px 15px'}}
        >
          <Row>
            <Col
              md={10}
              xs={8}
            >
              <h2 style={settingsPage.sectionHeading}>{'Team Management'}</h2>
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
                >{'⊞ Add new team'}</a>
              </p>
            </Col>
          </Row>
          { teamsRow }
          <hr/>
          { optionsRow }
        </Grid>
        <Navbar className='navbar-fixed-bottom'>
          <div
            className='text-right'
            style={settingsPage.footer}
          >
            <Button
              id='btnCancel'
              className='btn-link'
              onClick={this.handleCancel}
            >{'Cancel'}</Button>
            { ' ' }
            <Button
              id='btnSave'
              className='navbar-btn'
              bsStyle='primary'
              onClick={this.handleSave}
              disabled={this.state.teams.length === 0}
            >{'Save'}</Button>
          </div>
        </Navbar>
      </div>
    );
  }
});

module.exports = SettingsPage;
