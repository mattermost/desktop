'use strict';

const {remote, ipcRenderer} = require('electron');
const settings = require('../common/settings');

const React = require('react');
const ReactDOM = require('react-dom');
const ReactBootstrap = require('react-bootstrap');
var AutoLaunch = require('auto-launch');

const Grid = ReactBootstrap.Grid;
const Row = ReactBootstrap.Row;
const Col = ReactBootstrap.Col;
const Input = ReactBootstrap.Input;
const Button = ReactBootstrap.Button;
const ListGroup = ReactBootstrap.ListGroup;
const ListGroupItem = ReactBootstrap.ListGroupItem;
const Glyphicon = ReactBootstrap.Glyphicon;

var appLauncher = new AutoLaunch({
  name: 'Mattermost'
});

function backToIndex() {
  remote.getCurrentWindow().loadURL('file://' + __dirname + '/index.html');
}

var SettingsPage = React.createClass({
  getInitialState: function() {
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
  componentDidMount: function() {
    if (process.platform === 'win32' || process.platform === 'linux') {
      var self = this;
      appLauncher.isEnabled().then(function(enabled) {
        self.setState({
          autostart: enabled
        });
      });
    }
  },
  handleTeamsChange: function(teams) {
    this.setState({
      showAddTeamForm: false,
      teams: teams
    });
  },
  handleSave: function() {
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
      }
    };
    settings.writeFileSync(this.props.configFile, config);
    if (process.platform === 'win32' || process.platform === 'linux') {
      var currentWindow = remote.getCurrentWindow();
      currentWindow.setAutoHideMenuBar(config.hideMenuBar);
      currentWindow.setMenuBarVisibility(!config.hideMenuBar);

      var autostart = this.state.autostart;
      appLauncher.isEnabled().then(function(enabled) {
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
  handleCancel: function() {
    backToIndex();
  },
  handleChangeDisableWebSecurity: function() {
    this.setState({
      disablewebsecurity: this.refs.disablewebsecurity.getChecked()
    });
  },
  handleChangeHideMenuBar: function() {
    this.setState({
      hideMenuBar: this.refs.hideMenuBar.getChecked()
    });
  },
  handleChangeShowTrayIcon: function() {
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
  handleChangeTrayIconTheme: function() {
    this.setState({
      trayIconTheme: this.refs.trayIconTheme.getValue()
    });
  },
  handleChangeAutoStart: function() {
    this.setState({
      autostart: this.refs.autostart.getChecked()
    });
  },
  handleChangeMinimizeToTray: function() {
    var shouldMinimizeToTray = (process.platform !== 'darwin' || this.refs.showTrayIcon.getChecked())
    && this.refs.minimizeToTray.getChecked();

    this.setState({
      minimizeToTray: shouldMinimizeToTray
    });
  },
  handleChangeToggleWindowOnTrayIconClick: function() {
    this.setState({
      toggleWindowOnTrayIconClick: this.refs.toggleWindowOnTrayIconClick.getChecked()
    });
  },
  toggleShowTeamForm: function() {
    this.setState({
      showAddTeamForm: !this.state.showAddTeamForm
    });
  },
  handleFlashWindowSetting: function(item) {
    this.setState({
      notifications: {
        flashWindow: item.state
      }
    });
  },
  render: function() {
    var teams_row = (
    <Row>
      <Col md={ 12 }>
      <TeamList teams={ this.state.teams } showAddTeamForm={ this.state.showAddTeamForm } onTeamsChange={ this.handleTeamsChange } />
      </Col>
    </Row>
    );

    var options = [];
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(<Input key="inputHideMenuBar" id="inputHideMenuBar" ref="hideMenuBar" type="checkbox" label="Hide menu bar (Press Alt to show menu bar)" checked={ this.state.hideMenuBar }
                     onChange={ this.handleChangeHideMenuBar } />);
    }
    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(<Input key="inputShowTrayIcon" id="inputShowTrayIcon" ref="showTrayIcon" type="checkbox" label="Show icon on menu bar (Need to restart the application)" checked={ this.state.showTrayIcon }
                     onChange={ this.handleChangeShowTrayIcon } />);
    }
    if (process.platform === 'linux') {
      options.push(<Input key="inputTrayIconTheme" ref="trayIconTheme" type="select" label="Icon theme (Need to restart the application)" value={ this.state.trayIconTheme } onChange={ this.handleChangeTrayIconTheme }>
                   <option value="light">Light</option>
                   <option value="dark">Dark</option>
                   </Input>);
    }
    options.push(<Input key="inputDisableWebSecurity" id="inputDisableWebSecurity" ref="disablewebsecurity" type="checkbox" label="Allow mixed content (Enabling allows both secure and insecure content, images and scripts to render and execute. Disabling allows only secure content.)"
                   checked={ this.state.disablewebsecurity } onChange={ this.handleChangeDisableWebSecurity } />);
    //OSX has an option in the Dock, to set the app to autostart, so we choose to not support this option for OSX
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(<Input key="inputAutoStart" id="inputAutoStart" ref="autostart" type="checkbox" label="Start app on login." checked={ this.state.autostart } onChange={ this.handleChangeAutoStart }
                   />);
    }

    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(<Input key="inputMinimizeToTray" id="inputMinimizeToTray" ref="minimizeToTray" type="checkbox" label={ this.state.trayWasVisible || !this.state.showTrayIcon ? "Leave app running in notification area when the window is closed" : "Leave app running in notification area when the window is closed (available on next restart)" } disabled={ !this.state.showTrayIcon || !this.state.trayWasVisible } checked={ this.state.minimizeToTray }
                     onChange={ this.handleChangeMinimizeToTray } />);
    }

    if (process.platform === 'win32') {
      options.push(<Input key="inputToggleWindowOnTrayIconClick" id="inputToggleWindowOnTrayIconClick" ref="toggleWindowOnTrayIconClick" type="checkbox" label="Toggle window visibility when clicking on the tray icon."
                     checked={ this.state.toggleWindowOnTrayIconClick } onChange={ this.handleChangeToggleWindowOnTrayIconClick } />);
    }

    var options_row = (options.length > 0) ? (
      <Row>
        <Col md={ 12 }>
        <h2>Options</h2>
        { options }
        </Col>
      </Row>
      ) : null;

    var notifications_row = null;
    if (process.platform === 'win32') {
      var notificationSettings = [
        {
          label: 'Never',
          state: 0
        },
        /* ToDo: Idle isn't implemented yet
        {
          label: 'Only when idle (after 10 seconds)',
          state: 1
        },*/
        {
          label: 'Always',
          state: 2
        }
      ];

      var that = this;
      var notificationElements = notificationSettings.map(function(item) {
        var boundClick = that.handleFlashWindowSetting.bind(that, item);
        return (
          <Input key={ "flashWindow" + item.state } name="handleFlashWindow" ref={ "flashWindow" + item.state } type="radio" label={ item.label } value={ item.state } onChange={ boundClick }
            checked={ that.state.notifications.flashWindow == item.state ? "checked" : "" } />
          );
      });

      notifications_row = (
        <Row id="notificationsRow">
          <Col md={ 12 }>
          <h3>Notifications</h3> Flash the taskbar icon when a new message is received.
          { notificationElements }
          </Col>
        </Row>
      );
    }

    return (
      <Grid className="settingsPage">
        <Row>
          <Col xs={ 4 } sm={ 2 } md={ 2 } lg={ 1 }>
          <h2>Teams</h2>
          </Col>
          <Col xs={ 8 } sm={ 10 } md={ 10 } lg={ 11 }>
          <Button bsSize="small" style={ { marginTop: 20 } } onClick={ this.toggleShowTeamForm }>
            <Glyphicon glyph="plus" />
          </Button>
          </Col>
        </Row>
        { teams_row }
        { options_row }
        { notifications_row }
        <div>
          <hr />
        </div>
        <Row>
          <Col md={ 12 }>
          <Button id="btnCancel" onClick={ this.handleCancel }>Cancel</Button>
          { ' ' }
          <Button id="btnSave" bsStyle="primary" onClick={ this.handleSave } disabled={ this.state.teams.length === 0 }>Save</Button>
          </Col>
        </Row>
      </Grid>
      );
  }
});

var TeamList = React.createClass({
  getInitialState: function() {
    return {
      showTeamListItemNew: false,
      team: {
        url: '',
        name: '',
        index: false
      }
    };
  },
  handleTeamRemove: function(index) {
    console.log(index);
    var teams = this.props.teams;
    teams.splice(index, 1);
    this.props.onTeamsChange(teams);
  },
  handleTeamAdd: function(team) {
    var teams = this.props.teams;

    // check if team already exists and then change existing team or add new one
    if ((team.index !== undefined) && teams[team.index]) {
      teams[team.index].name = team.name;
      teams[team.index].url = team.url;
    } else {
      teams.push(team);
    }

    this.setState({
      showTeamListItemNew: false,
      team: {
        url: '',
        name: '',
        index: false
      }
    });

    this.props.onTeamsChange(teams);
  },
  handleTeamEditing: function(teamName, teamUrl, teamIndex) {
    this.setState({
      showTeamListItemNew: true,
      team: {
        url: teamUrl,
        name: teamName,
        index: teamIndex
      }
    })
  },
  render: function() {
    var thisObj = this;
    var teamNodes = this.props.teams.map(function(team, i) {
      var handleTeamRemove = function() {
        thisObj.handleTeamRemove(i);
      };

      var handleTeamEditing = function() {
        thisObj.handleTeamEditing(team.name, team.url, i);
      };

      return (
        <TeamListItem index={ i } key={ "teamListItem" + i } name={ team.name } url={ team.url } onTeamRemove={ handleTeamRemove } onTeamEditing={ handleTeamEditing }
        />
        );
    });

    var addTeamForm;
    if (this.props.showAddTeamForm || this.state.showTeamListItemNew) {
      addTeamForm = <TeamListItemNew key={ this.state.team.index } onTeamAdd={ this.handleTeamAdd } teamIndex={ this.state.team.index } teamName={ this.state.team.name } teamUrl={ this.state.team.url }
                    />;
    } else {
      addTeamForm = '';
    }

    return (
      <ListGroup class="teamList">
        { teamNodes }
        { addTeamForm }
      </ListGroup>
      );
  }
});

var TeamListItem = React.createClass({
  handleTeamRemove: function() {
    this.props.onTeamRemove();
  },
  handleTeamEditing: function() {
    this.props.onTeamEditing();
  },
  render: function() {
    var style = {
      left: {
        "display": 'inline-block'
      }
    };
    return (
      <div className="teamListItem list-group-item">
        <div style={ style.left }>
          <h4 className="list-group-item-heading">{ this.props.name }</h4>
          <p className="list-group-item-text">
            { this.props.url }
          </p>
        </div>
        <div className="pull-right">
          <Button bsSize="xsmall" onClick={ this.handleTeamEditing }>
            <Glyphicon glyph="pencil" />
          </Button>
          { ' ' }
          <Button bsSize="xsmall" onClick={ this.handleTeamRemove }>
            <Glyphicon glyph="remove" />
          </Button>
        </div>
      </div>
      );
  }
});

var TeamListItemNew = React.createClass({
  getInitialState: function() {
    return {
      name: this.props.teamName,
      url: this.props.teamUrl,
      index: this.props.teamIndex
    };
  },
  handleSubmit: function(e) {
    console.log('submit');
    e.preventDefault();
    this.props.onTeamAdd({
      name: this.state.name.trim(),
      url: this.state.url.trim(),
      index: this.state.index,
    });

    this.setState({
      name: '',
      url: '',
      index: ''
    });
  },
  handleNameChange: function(e) {
    console.log('name');
    this.setState({
      name: e.target.value
    });
  },
  handleURLChange: function(e) {
    console.log('url');
    this.setState({
      url: e.target.value
    });
  },
  shouldEnableAddButton: function() {
    return (this.state.name.trim() !== '' || this.props.teamName !== '')
      && (this.state.url.trim() !== '' || this.props.teamUrl !== '');
  },
  render: function() {

    var existingTeam = false;
    if (this.state.name !== '' && this.state.url !== '') {
      existingTeam = true;
    }

    var btnAddText;
    if (existingTeam) {
      btnAddText = 'Save';
    } else {
      btnAddText = 'Add';
    }

    return (
      <ListGroupItem>
        <form className="form-inline" onSubmit={ this.handleSubmit }>
          <div className="form-group">
            <label for="inputTeamName">Name</label>
            { ' ' }
            <input type="text" className="form-control" id="inputTeamName" placeholder="Example team" value={ this.state.name } onChange={ this.handleNameChange } />
          </div>
          { ' ' }
          <div className="form-group">
            <label for="inputTeamURL">URL</label>
            { ' ' }
            <input type="url" className="form-control" id="inputTeamURL" placeholder="https://example.com/team" value={ this.state.url } onChange={ this.handleURLChange } />
          </div>
          { ' ' }
          <Button type="submit" disabled={ !this.shouldEnableAddButton() }>
            { btnAddText }
          </Button>
        </form>
      </ListGroupItem>
      );
  }
});

var configFile = remote.getGlobal('config-file');

var contextMenu = require('./menus/context');
var menu = contextMenu.createDefault();
window.addEventListener('contextmenu', function(e) {
  menu.popup(remote.getCurrentWindow());
}, false);

ReactDOM.render(
  <SettingsPage configFile={ configFile } />,
  document.getElementById('content')
);
