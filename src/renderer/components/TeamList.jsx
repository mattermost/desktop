// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import PropTypes from 'prop-types';
import {ListGroup} from 'react-bootstrap';

import TeamListItem from './TeamListItem.jsx';
import NewTeamModal from './NewTeamModal.jsx';
import RemoveServerModal from './RemoveServerModal.jsx';

export default class TeamList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      showEditTeamForm: false,
      indexToRemoveServer: -1,
      team: {
        url: '',
        name: '',
        index: false,
        order: props.teams.length,
      },
    };
  }

  handleTeamRemove = (index) => {
    console.log(index);
    const teams = this.props.teams;
    const removedOrder = this.props.teams[index].order;
    teams.splice(index, 1);
    teams.forEach((value) => {
      if (value.order > removedOrder) {
        value.order--;
      }
    });
    this.props.onTeamsChange(teams);
  }

  handleTeamAdd = (team) => {
    const teams = this.props.teams;

    // check if team already exists and then change existing team or add new one
    if ((typeof team.index !== 'undefined') && teams[team.index]) {
      teams[team.index].name = team.name;
      teams[team.index].url = team.url;
      teams[team.index].order = team.order;
    } else {
      teams.push(team);
    }

    this.setState({
      showEditTeamForm: false,
      team: {
        url: '',
        name: '',
        index: false,
        order: teams.length,
      },
    });

    this.props.onTeamsChange(teams);
  }

  handleTeamEditing = (teamName, teamUrl, teamIndex, teamOrder) => {
    this.setState({
      showEditTeamForm: true,
      team: {
        url: teamUrl,
        name: teamName,
        index: teamIndex,
        order: teamOrder,
      },
    });
  }

  openServerRemoveModal = (indexForServer) => {
    this.setState({indexToRemoveServer: indexForServer});
  }

  closeServerRemoveModal = () => {
    this.setState({indexToRemoveServer: -1});
  }

  render() {
    const self = this;
    const teamNodes = this.props.teams.map((team, i) => {
      function handleTeamRemove() {
        document.activeElement.blur();
        self.openServerRemoveModal(i);
      }

      function handleTeamEditing() {
        document.activeElement.blur();
        self.handleTeamEditing(team.name, team.url, i, team.order);
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

    const addServerForm = (
      <NewTeamModal
        currentOrder={this.props.teams.length}
        show={this.props.showAddTeamForm || this.state.showEditTeamForm}
        editMode={this.state.showEditTeamForm}
        onClose={() => {
          this.setState({
            showEditTeamForm: false,
            team: {
              name: '',
              url: '',
              index: false,
              order: this.props.teams.length,
            },
          });
          this.props.setAddTeamFormVisibility(false);
        }}
        onSave={(newTeam) => {
          const teamData = {
            name: newTeam.name,
            url: newTeam.url,
            order: newTeam.order,
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
              order: newTeam.order + 1,
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
  }
}

TeamList.propTypes = {
  onTeamsChange: PropTypes.func,
  showAddTeamForm: PropTypes.bool,
  teams: PropTypes.array,
  addServer: PropTypes.func,
  updateTeam: PropTypes.func,
  toggleAddTeamForm: PropTypes.func,
  setAddTeamFormVisibility: PropTypes.func,
  onTeamClick: PropTypes.func,
};
