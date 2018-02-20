const React = require('react');
const PropTypes = require('prop-types');
const createReactClass = require('create-react-class');
const {ListGroup} = require('react-bootstrap');

const TeamListItem = require('./TeamListItem.jsx');
const NewTeamModal = require('./NewTeamModal.jsx');
const RemoveServerModal = require('./RemoveServerModal.jsx');

const TeamList = createReactClass({
  propTypes: {
    onTeamsChange: PropTypes.func,
    showAddTeamForm: PropTypes.bool,
    teams: PropTypes.array,
    addServer: PropTypes.func,
    updateTeam: PropTypes.func,
    toggleAddTeamForm: PropTypes.func,
    setAddTeamFormVisibility: PropTypes.func,
    onTeamClick: PropTypes.func,
  },

  getInitialState() {
    return {
      showEditTeamForm: false,
      indexToRemoveServer: -1,
      team: {
        url: '',
        name: '',
        index: false,
      },
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
      showEditTeamForm: false,
      team: {
        url: '',
        name: '',
        index: false,
      },
    });

    this.props.onTeamsChange(teams);
  },
  handleTeamEditing(teamName, teamUrl, teamIndex) {
    this.setState({
      showEditTeamForm: true,
      team: {
        url: teamUrl,
        name: teamName,
        index: teamIndex,
      },
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
        document.activeElement.blur();
        self.openServerRemoveModal(i);
      }

      function handleTeamEditing() {
        document.activeElement.blur();
        self.handleTeamEditing(team.name, team.url, i);
      }

      function handleTeamClick() {
        self.props.onTeamClick(i);
      }

      return (
        <TeamListItem
          index={i}
          key={'teamListItem' + i}
          name={team.name}
          url={team.url}
          onTeamRemove={handleTeamRemove}
          onTeamEditing={handleTeamEditing}
          onTeamClick={handleTeamClick}
        />
      );
    });

    var addServerForm = (
      <NewTeamModal
        show={this.props.showAddTeamForm || this.state.showEditTeamForm}
        editMode={this.state.showEditTeamForm}
        onClose={() => {
          this.setState({
            showEditTeamForm: false,
            team: {
              name: '',
              url: '',
              index: false,
            },
          });
          this.props.setAddTeamFormVisibility(false);
        }}
        onSave={(newTeam) => {
          var teamData = {
            name: newTeam.name,
            url: newTeam.url,
          };
          if (this.props.showAddTeamForm) {
            this.props.addServer(teamData);
          } else {
            this.props.updateTeam(newTeam.index, teamData);
          }
          this.setState({
            showNewTeamModal: false,
            showEditTeamForm: false,
            team: {
              name: '',
              url: '',
              index: false,
            },
          });
          this.render();
          this.props.setAddTeamFormVisibility(false);
        }}
        team={this.state.team}
      />);

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
        { addServerForm }
        { removeServerModal}
      </ListGroup>
    );
  },
});

module.exports = TeamList;
