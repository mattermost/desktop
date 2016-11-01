const React = require('react');
const {Col, Grid, Navbar, Input, Row} = require('react-bootstrap');

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
      disablewebsecurity: this.refs.disablewebsecurity.getChecked()
    });
  },
  handleChangeHideMenuBar() {
    this.setState({
      hideMenuBar: this.refs.hideMenuBar.getChecked()
    });
  },
  handleChangeShowTrayIcon() {
    var shouldShowTrayIcon = this.refs.showTrayIcon.getChecked();
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
      trayIconTheme: this.refs.trayIconTheme.getValue()
    });
  },
  handleChangeAutoStart() {
    this.setState({
      autostart: this.refs.autostart.getChecked()
    });
  },
  handleChangeMinimizeToTray() {
    var shouldMinimizeToTray =
      (process.platform !== 'darwin' || this.refs.showTrayIcon.getChecked()) &&
      this.refs.minimizeToTray.getChecked();

    this.setState({
      minimizeToTray: shouldMinimizeToTray
    });
  },
  handleChangeToggleWindowOnTrayIconClick() {
    this.setState({
      toggleWindowOnTrayIconClick: this.refs.toggleWindowOnTrayIconClick.getChecked()
    });
  },
  toggleShowTeamForm() {
    this.setState({
      showAddTeamForm: !this.state.showAddTeamForm
    });
  },
  handleFlashWindow() {
    this.setState({
      notifications: {
        flashWindow: this.refs.flashWindow.getChecked() ? 2 : 0
      }
    });
  },
  handleShowUnreadBadge() {
    this.setState({
      showUnreadBadge: this.refs.showUnreadBadge.getChecked()
    });
  },
  render() {
    var teamsRow = (
      <Row>
        <Col md={12}>
          <TeamList
            teams={this.state.teams}
            showAddTeamForm={this.state.showAddTeamForm}
            onTeamsChange={this.handleTeamsChange}
          />
        </Col>
      </Row>
    );

    var options = [];
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Input
          key='inputHideMenuBar'
          id='inputHideMenuBar'
          ref='hideMenuBar'
          type='checkbox'
          label='Hide menu bar (Press Alt to show menu bar)'
          checked={this.state.hideMenuBar}
          onChange={this.handleChangeHideMenuBar}
        />);
    }
    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(
        <Input
          key='inputShowTrayIcon'
          id='inputShowTrayIcon'
          ref='showTrayIcon'
          type='checkbox'
          label={process.platform === 'darwin' ?
            'Show icon on menu bar (need to restart the application)' :
            'Show icon in notification area (need to restart the application)'}
          checked={this.state.showTrayIcon}
          onChange={this.handleChangeShowTrayIcon}
        />);
    }
    if (process.platform === 'linux') {
      options.push(
        <Input
          key='inputTrayIconTheme'
          ref='trayIconTheme'
          type='select'
          label='Icon theme (Need to restart the application)'
          value={this.state.trayIconTheme}
          onChange={this.handleChangeTrayIconTheme}
        >
          <option value='light'>{'Light'}</option>
          <option value='dark'>{'Dark'}</option>
        </Input>);
    }
    options.push(
      <Input
        key='inputDisableWebSecurity'
        id='inputDisableWebSecurity'
        ref='disablewebsecurity'
        type='checkbox'
        label='Allow mixed content (Enabling allows both secure and insecure content, images and scripts to render and execute. Disabling allows only secure content.)'
        checked={this.state.disablewebsecurity}
        onChange={this.handleChangeDisableWebSecurity}
      />);

    //OSX has an option in the Dock, to set the app to autostart, so we choose to not support this option for OSX
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Input
          key='inputAutoStart'
          id='inputAutoStart'
          ref='autostart'
          type='checkbox'
          label='Start app on login.'
          checked={this.state.autostart}
          onChange={this.handleChangeAutoStart}
        />);
    }

    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(
        <Input
          key='inputMinimizeToTray'
          id='inputMinimizeToTray'
          ref='minimizeToTray'
          type='checkbox'
          label={this.state.trayWasVisible || !this.state.showTrayIcon ? 'Leave app running in notification area when the window is closed' : 'Leave app running in notification area when the window is closed (available on next restart)'}
          disabled={!this.state.showTrayIcon || !this.state.trayWasVisible}
          checked={this.state.minimizeToTray}
          onChange={this.handleChangeMinimizeToTray}
        />);
    }

    if (process.platform === 'win32') {
      options.push(
        <Input
          key='inputToggleWindowOnTrayIconClick'
          id='inputToggleWindowOnTrayIconClick'
          ref='toggleWindowOnTrayIconClick'
          type='checkbox'
          label='Toggle window visibility when clicking on the tray icon.'
          checked={this.state.toggleWindowOnTrayIconClick}
          onChange={this.handleChangeToggleWindowOnTrayIconClick}
        />);
    }

    if (process.platform === 'darwin' || process.platform === 'win32') {
      options.push(
        <Input
          key='inputShowUnreadBadge'
          id='inputShowUnreadBadge'
          ref='showUnreadBadge'
          type='checkbox'
          label='Show red badge on taskbar icon to indicate unread messages. Regardless of this setting, mentions are always indicated with a red badge and item count on the taskbar icon.'
          checked={this.state.showUnreadBadge}
          onChange={this.handleShowUnreadBadge}
        />);
    }

    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Input
          key='flashWindow'
          id='inputflashWindow'
          ref='flashWindow'
          type='checkbox'
          label='Flash the taskbar icon when a new message is received.'
          checked={this.state.notifications.flashWindow === 2}
          onChange={this.handleFlashWindow}
        />);
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
          { options }
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
            <button
              id='btnCancel'
              className='btn btn-link'
              onClick={this.handleCancel}
            >{'Cancel'}</button>
            { ' ' }
            <button
              id='btnSave'
              className='btn btn-primary navbar-btn'
              bsStyle='primary'
              onClick={this.handleSave}
              disabled={this.state.teams.length === 0}
            >{'Save'}</button>
          </div>
        </Navbar>
      </div>
    );
  }
});

module.exports = SettingsPage;
