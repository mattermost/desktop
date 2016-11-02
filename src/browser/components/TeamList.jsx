const React = require('react');
const {ListGroup} = require('react-bootstrap');
const TeamListItem = require('./TeamListItem.jsx');
const TeamListItemNew = require('./TeamListItemNew.jsx');

const TeamList = React.createClass({
  propTypes: {
    onTeamsChange: React.PropTypes.func,
    showAddTeamForm: React.PropTypes.bool,
    teams: React.PropTypes.array
  },

  getInitialState() {
    return {
      showTeamListItemNew: false,
      team: {
        url: '',
        name: '',
        index: false
      }
    };
  },
  handleTeamRemove(index) {
    console.log(index);
    var teams = this.props.teams;
    teams.splice(index, 1);
    this.props.onTeamsChange(teams);
  },
  handleTeamAdd(team) {
    var teams = this.props.teams;

    // check if team already exists and then change existing team or add new one
    if ((typeof team.index !== 'undefined') && teams[team.index]) {
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
  handleTeamEditing(teamName, teamUrl, teamIndex) {
    this.setState({
      showTeamListItemNew: true,
      team: {
        url: teamUrl,
        name: teamName,
        index: teamIndex
      }
    });
  },
  render() {
    var self = this;
    var teamNodes = this.props.teams.map((team, i) => {
      function handleTeamRemove() {
        self.handleTeamRemove(i);
      }

      function handleTeamEditing() {
        self.handleTeamEditing(team.name, team.url, i);
      }

      return (
        <TeamListItem
          index={i}
          key={'teamListItem' + i}
          name={team.name}
          url={team.url}
          onTeamRemove={handleTeamRemove}
          onTeamEditing={handleTeamEditing}
        />
      );
    });

    var addTeamForm;
    if (this.props.showAddTeamForm || this.state.showTeamListItemNew) {
      addTeamForm = (
        <TeamListItemNew
          key={this.state.team.index}
          onTeamAdd={this.handleTeamAdd}
          teamIndex={this.state.team.index}
          teamName={this.state.team.name}
          teamUrl={this.state.team.url}
        />);
    } else {
      addTeamForm = '';
    }

    return (
      <ListGroup className='teamList'>
        { teamNodes }
        { addTeamForm }
      </ListGroup>
    );
  }
});

module.exports = TeamList;
