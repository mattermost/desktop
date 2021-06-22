// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import {ListGroup} from 'react-bootstrap';

import {Team, TeamWithIndex} from 'types/config';

import TeamListItem from './TeamListItem';
import NewTeamModal from './NewTeamModal';
import RemoveServerModal from './RemoveServerModal';

type Props = {
    onTeamClick: (teamName: string) => void;
    onTeamsChange: (teams: Team[]) => void;
    showAddTeamForm?: boolean;
    teams: Team[];
    addServer: (team: Team) => void;
    updateTeam: (index: number, team: Team) => void;
    setAddTeamFormVisibility: (visible: boolean) => void;
};

type State = {
    team: TeamWithIndex;
    showEditTeamForm: boolean;
    indexToRemoveServer: number;
}

export default class TeamList extends React.PureComponent<Props, State> {
    constructor(props: Props) {
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

    handleTeamRemove = (index: number) => {
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

    handleTeamAdd = (team: TeamWithIndex) => {
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

    openServerRemoveModal = (indexForServer: number) => {
        this.setState({indexToRemoveServer: indexForServer});
    }

    closeServerRemoveModal = () => {
        this.setState({indexToRemoveServer: -1});
    }

    handleTeamRemovePrompt = (index: number) => {
        return () => {
            document.activeElement.blur();
            this.openServerRemoveModal(index);
        };
    }

    handleTeamEditing = (team: Team, index: number) => {
        return () => {
            document.activeElement.blur();
            this.setState({
                showEditTeamForm: true,
                team: {
                    url: team.url,
                    name: team.name,
                    index,
                    order: team.order,
                },
            });
        };
    }

    render() {
        const teamNodes = this.props.teams.map((team, i) => {
            return (
                <TeamListItem
                    key={`teamListItem_${team.name}`}
                    name={team.name}
                    url={team.url}
                    onTeamRemove={this.handleTeamRemovePrompt(i)}
                    onTeamEditing={this.handleTeamEditing(team, i)}
                    onTeamClick={() => this.props.onTeamClick(team.name)}
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
