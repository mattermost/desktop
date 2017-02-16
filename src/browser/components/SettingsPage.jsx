const React = require('react');
const ReactDOM = require('react-dom');
const ReactCSSTransitionGroup = require('react-addons-css-transition-group');
const {Button, Checkbox, Col, FormGroup, Grid, HelpBlock, Navbar, Radio, Row} = require('react-bootstrap');

const {ipcRenderer, remote} = require('electron');
const AutoLaunch = require('auto-launch');
const {debounce} = require('underscore');

const settings = require('../../common/settings');

const TeamList = require('./TeamList.jsx');
const AutoSaveIndicator = require('./AutoSaveIndicator.jsx');

const appLauncher = new AutoLaunch({
  name: 'Mattermost',
  isHidden: true
});

function backToIndex(index) {
  const target = typeof index === 'undefined' ? 0 : index;
  remote.getCurrentWindow().loadURL(`file://${__dirname}/index.html?index=${target}`);
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
    initialState.disableClose = initialState.teams.length === 0;
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
  },

  setSavingState(state) {
    if (!this.setSavingStateDone) {
      this.setSavingStateDone = debounce(() => {
        this.setState({savingState: 'done'});
      }, 2000);
    }
    this.setState({savingState: state});
    if (state === 'saved') {
      this.setSavingStateDone();
    }
  },

  handleTeamsChange(teams) {
    this.setState({
      showAddTeamForm: false,
      teams
    });
    if (teams.length === 0) {
      this.setState({showAddTeamForm: true});
    }
    setImmediate(this.saveConfig);
  },
  saveConfig() {
    this.setSavingState('saving');
    var config = {
      teams: this.state.teams,
      showTrayIcon: this.state.showTrayIcon,
      trayIconTheme: this.state.trayIconTheme,
      disablewebsecurity: this.state.disablewebsecurity,
      version: settings.version,
      minimizeToTray: this.state.minimizeToTray,
      notifications: {
        flashWindow: this.state.notifications.flashWindow
      },
      showUnreadBadge: this.state.showUnreadBadge
    };
    settings.writeFileSync(this.props.configFile, config);
    if (process.platform === 'win32' || process.platform === 'linux') {
      var autostart = this.state.autostart;
      appLauncher.isEnabled().then((enabled) => {
        if (enabled && !autostart) {
          appLauncher.disable().then(() => {
            this.setSavingState('saved');
          });
        } else if (!enabled && autostart) {
          appLauncher.enable().then(() => {
            this.setSavingState('saved');
          });
        } else {
          this.setSavingState('saved');
        }
      });
    } else {
      this.setSavingState('saved');
    }

    ipcRenderer.send('update-menu', config);
    ipcRenderer.send('update-config');
  },
  handleCancel() {
    backToIndex();
  },
  handleChangeDisableWebSecurity() {
    this.setState({
      disablewebsecurity: this.refs.disablewebsecurity.props.checked
    });
    setImmediate(this.saveConfig);
  },
  handleChangeHideMenuBar() {
    this.setState({
      hideMenuBar: this.refs.hideMenuBar.props.checked
    });
    setImmediate(this.saveConfig);
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

    setImmediate(this.saveConfig);
  },
  handleChangeTrayIconTheme() {
    this.setState({
      trayIconTheme: ReactDOM.findDOMNode(this.refs.trayIconTheme).value
    });
    setImmediate(this.saveConfig);
  },
  handleChangeAutoStart() {
    this.setState({
      autostart: !this.refs.autostart.props.checked
    });
    setImmediate(this.saveConfig);
  },
  handleChangeMinimizeToTray() {
    const shouldMinimizeToTray = this.state.showTrayIcon && !this.refs.minimizeToTray.props.checked;

    this.setState({
      minimizeToTray: shouldMinimizeToTray
    });
    setImmediate(this.saveConfig);
  },
  toggleShowTeamForm() {
    this.setState({
      showAddTeamForm: !this.state.showAddTeamForm
    });
    setImmediate(this.saveConfig);
  },
  setShowTeamFormVisibility(val) {
    this.setState({
      showAddTeamForm: val
    });
    setImmediate(this.saveConfig);
  },
  handleFlashWindow() {
    this.setState({
      notifications: {
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2
      }
    });
    setImmediate(this.saveConfig);
  },
  handleShowUnreadBadge() {
    this.setState({
      showUnreadBadge: !this.refs.showUnreadBadge.props.checked
    });
    setImmediate(this.saveConfig);
  },

  updateTeam(index, newData) {
    var teams = this.state.teams;
    teams[index] = newData;
    this.setState({
      teams
    });
    setImmediate(this.saveConfig);
  },

  addServer(team) {
    var teams = this.state.teams;
    teams.push(team);
    this.setState({
      teams
    });
    setImmediate(this.saveConfig);
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
        key='inputDisableWebSecurity'
        id='inputDisableWebSecurity'
        ref='disablewebsecurity'
        checked={!this.state.disablewebsecurity}
        onChange={this.handleChangeDisableWebSecurity}
      >{'Display secure content only'}
        <HelpBlock>
          {'If enabled, the app only displays secure (HTTPS/SSL) content.'}
          {' '}
          {'If disabled, the app displays secure and non-secure (HTTP) content such as images.'}
        </HelpBlock>
      </Checkbox>);

    if (process.platform === 'darwin' || process.platform === 'win32') {
      options.push(
        <Checkbox
          key='inputShowUnreadBadge'
          id='inputShowUnreadBadge'
          ref='showUnreadBadge'
          checked={this.state.showUnreadBadge}
          onChange={this.handleShowUnreadBadge}
        >{'Show red badge on taskbar icon to indicate unread messages'}
          <HelpBlock>
            {'Regardless of this setting, mentions are always indicated with a red badge and item count on the taskbar icon.'}
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
        >{'Flash taskbar icon when a new message is received'}
          <HelpBlock>
            {'If enabled, taskbar icon flashes for a few seconds when a new message is received.'}
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
            <ReactCSSTransitionGroup
              transitionName='AutoSaveIndicator'
              transitionEnterTimeout={500}
              transitionLeaveTimeout={1000}
            >
              { this.state.savingState === 'done' ? null : <AutoSaveIndicator savingState={this.state.savingState}/> }
            </ReactCSSTransitionGroup>
          </div>
          <div style={{position: 'relative'}}>
            <h1 style={settingsPage.heading}>{'Settings'}</h1>
            <Button
              id='btnClose'
              bsStyle='link'
              style={settingsPage.close}
              onClick={this.handleCancel}
              disabled={this.state.disableClose}
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
