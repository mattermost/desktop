'use strict';

const remote = require('electron').remote;
const settings = require('../common/settings');

const React = require('react');
const ReactDOM = require('react-dom');
const ReactBootstrap = require('react-bootstrap');

const Grid = ReactBootstrap.Grid;
const Row = ReactBootstrap.Row;
const Col = ReactBootstrap.Col;
const Input = ReactBootstrap.Input;
const Button = ReactBootstrap.Button;
const ListGroup = ReactBootstrap.ListGroup;
const ListGroupItem = ReactBootstrap.ListGroupItem;
const Glyphicon = ReactBootstrap.Glyphicon;

function backToIndex() {
  remote.getCurrentWindow().loadURL('file://' + __dirname + '/index.html');
}

var SettingsPage = React.createClass({
  getInitialState: function() {
    var config;
    try {
      config = settings.readFileSync(this.props.configFile);
    } catch (e) {
      config = settings.loadDefault();
    }

    this.setState({
      showAddTeamForm: false
    });

    return config;
  },
  handleTeamsChange: function(teams) {
    this.setState({
      teams: teams
    });

    this.handleSave(false);
  },
  handleSave: function(toIndex) {
    var config = {
      teams: this.state.teams,
      hideMenuBar: this.state.hideMenuBar,
      showTrayIcon: this.state.showTrayIcon,
      trayIconTheme: this.state.trayIconTheme,
      disablewebsecurity: this.state.disablewebsecurity,
      version: settings.version
    };
    settings.writeFileSync(this.props.configFile, config);
    if (process.platform === 'win32' || process.platform === 'linux') {
      var currentWindow = remote.getCurrentWindow();
      currentWindow.setAutoHideMenuBar(config.hideMenuBar);
      currentWindow.setMenuBarVisibility(!config.hideMenuBar);
    }

    if (typeof toIndex == 'undefined' || toIndex) {
      backToIndex();
    }
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
    this.setState({
      showTrayIcon: this.refs.showTrayIcon.getChecked()
    });
  },
  handleChangeTrayIconTheme: function() {
    this.setState({
      trayIconTheme: this.refs.trayIconTheme.getValue()
    });
  },
  handleShowTeamForm: function() {
    if (!this.state.showAddTeamForm) {
      this.setState({
        showAddTeamForm: true
      });
    } else {
      this.setState({
        showAddTeamForm: false
      });
    }
  },
  render: function() {
    var teams_row = (
    <Row>
      <Col md={ 12 }>
      <h2>
                Teams
                <Button className="pull-right" bsSize="small" onClick={ this.handleShowTeamForm }>
                  <Glyphicon glyph="plus" />
                </Button>
              </h2>
      <TeamList teams={ this.state.teams } showAddTeamForm={ this.state.showAddTeamForm } onTeamsChange={ this.handleTeamsChange } />
      </Col>
    </Row>
    );

    var options = [];
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(<Input key="inputHideMenuBar" id="inputHideMenuBar" ref="hideMenuBar" type="checkbox" label="Hide Menu Bar (Press Alt to show Menu Bar)" checked={ this.state.hideMenuBar }
                     onChange={ this.handleChangeHideMenuBar } />);
    }
    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(<Input key="inputShowTrayIcon" ref="showTrayIcon" type="checkbox" label="Show Icon on Menu Bar (Need to restart the application)" checked={ this.state.showTrayIcon } onChange={ this.handleChangeShowTrayIcon }
                   />);
    }
    if (process.platform === 'linux') {
      options.push(<Input key="inputTrayIconTheme" ref="trayIconTheme" type="select" label="Icon theme (Need to restart the application)" value={ this.state.trayIconTheme } onChange={ this.handleChangeTrayIconTheme }>
                   <option value="light">Light</option>
                   <option value="dark">Dark</option>
                   </Input>);
    }
    options.push(<Input key="inputDisableWebSecurity" ref="disablewebsecurity" type="checkbox" label="Allow mixed content (Enabling allows both secure and insecure content, images and scripts to render and execute. Disabling allows only secure content.)"
                   checked={ this.state.disablewebsecurity } onChange={ this.handleChangeDisableWebSecurity } />);
    var options_row = (options.length > 0) ? (
      <Row>
        <Col md={ 12 }>
        <h2>Options</h2>
        { options }
        </Col>
      </Row>
      ) : null;

    return (
      <Grid className="settingsPage">
        { teams_row }
        { options_row }
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
    if (!team.index && teams[team.index]) {
      teams[team.index].name = team.name;
      teams[team.index].url = team.url;
    } else {
      teams.push(team);
    }

    this.setState({
      showTeamListItemNew: false
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
      addTeamForm = <TeamListItemNew onTeamAdd={ this.handleTeamAdd } teamIndex={ this.state.team.index } teamName={ this.state.team.name } teamUrl={ this.state.team.url } />;
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
    this.setState(this.getInitialState());
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
