const React = require('react');
const {ListGroup} = require('react-bootstrap');
const TeamListItem = require('./TeamListItem.jsx');
const NewTeamModal = require('./NewTeamModal.jsx');
const RemoveServerModal = require('./RemoveServerModal.jsx');

const TeamList = React.createClass({
  propTypes: {
    onTeamsChange: React.PropTypes.func,
    showAddTeamForm: React.PropTypes.bool,
    teams: React.PropTypes.array,
    toggleAddTeamForm: React.PropTypes.func
  },

  getInitialState() {
    return {
      showTeamListItemNew: false,
      indexToRemoveServer: -1,
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

  openServerRemoveModal(indexForServer) {
    this.setState({indexToRemoveServer: indexForServer});
  },

  closeServerRemoveModal() {
    this.setState({indexToRemoveServer: -1});
  },

  render() {
    var self = this;
    var teamNodes = this.props.teams.map((team, i) => {
      function handleTeamRemove() {
        self.openServerRemoveModal(i);
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
        <NewTeamModal
          onClose={this.props.toggleAddTeamForm}
          onSave={(newTeam) => {
            this.setState({
              showNewTeamModal: false
            });
            this.props.teams.push(newTeam);
            this.render();

            this.props.onTeamsChange(this.props.teams);
          }}
        />);
    } else {
      addTeamForm = '';
    }

    const removeServer = this.props.teams[this.state.indexToRemoveServer];
    const removeServerModal = (
      <RemoveServerModal
        show={this.state.indexToRemoveServer !== -1}
        serverName={removeServer ? removeServer.name : ''}
        onHide={this.closeServerRemoveModal}
        onCancel={this.closeServerRemoveModal}
        onAccept={() => {
          this.handleTeamRemove(this.state.indexToRemoveServer);
          this.closeServerRemoveModal();
        }}
      />
    );

    return (
      <ListGroup className='teamList'>
        { teamNodes }
        { addTeamForm }
        { removeServerModal}
      </ListGroup>
    );
  }
});

module.exports = TeamList;
