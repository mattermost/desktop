'use strict';

const remote = require('electron').remote;
const settings = require('./common/settings');

var SettingsPage = React.createClass({
  getInitialState: function() {
    return {
      teams: []
    };
  },
  componentDidMount: function() {
    var config = settings.readFileSync(this.props.configFile);
    this.setState({teams: config.teams})
  },
  handleTeamsChange: function(teams) {
    this.setState({teams: teams});
  },
  handleOK: function() {
    var config = {
      teams: this.state.teams,
      version: 1
    };
    settings.writeFileSync(this.props.configFile, config);
    window.location = './index.html';
  },
  handleCancel: function() {
    window.location = './index.html';
  },
  render: function() {
    return (
      <div className="settingsPage">
        <TeamList teams={this.state.teams} onTeamsChange={this.handleTeamsChange} />
        <input type="button" value="OK" onClick={this.handleOK} />
        <input type="button" value="Cancel" onClick={this.handleCancel} />
      </div>
    );
  }
});

var TeamList = React.createClass({
  handleTeamChange: function(index, team){
    var teams = this.props.teams;
    teams[index] = team;
    this.props.onTeamsChange(teams);
  },
  handleNewTeamAdd: function(team){
    var teams = this.props.teams;
    teams.push(team);
    this.props.onTeamsChange(teams);
  },
  render: function() {
    var thisObj = this;
    var teamNodes = this.props.teams.map(function(team, i){
      var handleTeamChange = function(team){
        thisObj.handleTeamChange(i, team);
      };
      return (
        <li><TeamItem index={i} name={team.name} url={team.url} onTeamChange={handleTeamChange} onName /></li>
      );
    });
    return (
      <div className="teamList">
        <ol>
          {teamNodes}
          <li><NewTeamItem onNewTeamAdd={this.handleNewTeamAdd} /></li>
        </ol>
      </div>
    );
  }
});

var TeamItem = React.createClass({
  handleNameChange: function(e){
    this.props.onTeamChange({name: e.target.value, url: this.props.url});
  },
  handleURLChange: function(e){
    this.props.onTeamChange({name: this.props.name, url: e.target.value});
  },
  render: function() {
    return (
      <div className="teamItem">
        <input type="text" placeholder="Team name" value={this.props.name} onChange={this.handleNameChange} ></input>
        <input type="text" placeholder="Team URL (http://example.com/team)" value={this.props.url} onChange={this.handleURLChange} ></input>
      </div>
    );
  }
});

var NewTeamItem = React.createClass({
  getInitialState: function(){
    return {name: '', url: ''};
  },
  handleNewTeamAdd: function(){
    this.props.onNewTeamAdd({name: this.state.name, url: this.state.url});
    this.setState(this.getInitialState());
  },
  handleNameChange: function(e){
    this.setState({name: e.target.value});
  },
  handleURLChange: function(e){
    this.setState({url: e.target.value});
  },
  render: function() {
    return (
      <div className="newTeamItem">
        <input type="text" placeholder="Team name" value={this.state.name} onChange={this.handleNameChange} />
        <input type="text" placeholder="Team URL (http://example.com/team)" value={this.state.url} onChange={this.handleURLChange} />
        <input type="button" value="Add" onClick={this.handleNewTeamAdd} />
      </div>
    );
  }
});

var configFile = remote.getGlobal('config-file');

ReactDOM.render(
  <SettingsPage configFile={configFile} />,
  document.getElementById('content')
);
