// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import {DragDropContext, Draggable, DraggingStyle, Droppable, DropResult, NotDraggingStyle} from 'react-beautiful-dnd';

import {Team, TeamWithTabs} from 'types/config';

import {
    CLOSE_TEAMS_DROPDOWN,
    REQUEST_TEAMS_DROPDOWN_INFO,
    SEND_DROPDOWN_MENU_SIZE,
    SHOW_NEW_SERVER_MODAL,
    SHOW_EDIT_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    SWITCH_SERVER, UPDATE_TEAMS,
    UPDATE_TEAMS_DROPDOWN,
} from 'common/communication';

import {getTabViewName} from 'common/tabs/TabView';

import './css/dropdown.scss';
import './css/compass-icons.css';

type State = {
    teams?: TeamWithTabs[];
    orderedTeams?: TeamWithTabs[];
    activeTeam?: string;
    darkMode?: boolean;
    enableServerManagement?: boolean;
    unreads?: Map<string, boolean>;
    mentions?: Map<string, number>;
    expired?: Map<string, boolean>;
    hasGPOTeams?: boolean;
    isAnyDragging: boolean;
}

function getStyle(style?: DraggingStyle | NotDraggingStyle) {
    if (style?.transform) {
        const axisLockY = `translate(0px${style.transform.slice(style.transform.indexOf(','), style.transform.length)}`;
        return {
            ...style,
            transform: axisLockY,
        };
    }
    return style;
}
class TeamDropdown extends React.PureComponent<Record<string, never>, State> {
    constructor(props: Record<string, never>) {
        super(props);
        this.state = {
            isAnyDragging: false,
        };

        window.addEventListener('message', this.handleMessageEvent);
    }

    handleMessageEvent = (event: MessageEvent) => {
        if (event.data.type === UPDATE_TEAMS_DROPDOWN) {
            const {teams, activeTeam, darkMode, enableServerManagement, hasGPOTeams, unreads, mentions, expired} = event.data.data;
            this.setState({
                teams,
                orderedTeams: teams.concat().sort((a: TeamWithTabs, b: TeamWithTabs) => a.order - b.order),
                activeTeam,
                darkMode,
                enableServerManagement,
                hasGPOTeams,
                unreads,
                mentions,
                expired,
            });
        }
    }

    selectServer = (team: Team) => {
        return () => {
            window.postMessage({type: SWITCH_SERVER, data: team.name}, window.location.href);
            this.closeMenu();
        };
    }

    closeMenu = () => {
        if (!this.state.isAnyDragging) {
            (document.activeElement as HTMLElement).blur();
            window.postMessage({type: CLOSE_TEAMS_DROPDOWN}, window.location.href);
        }
    }

    preventPropogation = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    }

    addServer = () => {
        window.postMessage({type: SHOW_NEW_SERVER_MODAL}, window.location.href);
        this.closeMenu();
    }

    isActiveTeam = (team: Team) => {
        return team.name === this.state.activeTeam;
    }

    onDragStart = () => {
        this.setState({isAnyDragging: true});
    }

    onDragEnd = (result: DropResult) => {
        const removedIndex = result.source.index;
        const addedIndex = result.destination?.index;
        if (addedIndex === undefined || removedIndex === addedIndex) {
            this.setState({isAnyDragging: false});
            return;
        }
        if (!this.state.teams) {
            throw new Error('No config');
        }
        const teams = this.state.teams.concat();
        const tabOrder = teams.map((team, index) => {
            return {
                index,
                order: team.order,
            };
        }).sort((a, b) => (a.order - b.order));

        const team = tabOrder.splice(removedIndex, 1);
        const newOrder = addedIndex < this.state.teams.length ? addedIndex : this.state.teams.length - 1;
        tabOrder.splice(newOrder, 0, team[0]);

        tabOrder.forEach((t, order) => {
            teams[t.index].order = order;
        });
        this.setState({teams, orderedTeams: teams.concat().sort((a: Team, b: Team) => a.order - b.order), isAnyDragging: false});
        window.postMessage({type: UPDATE_TEAMS, data: teams}, window.location.href);
    }

    componentDidMount() {
        window.postMessage({type: REQUEST_TEAMS_DROPDOWN_INFO}, window.location.href);
        window.addEventListener('click', this.closeMenu);
    }

    componentDidUpdate() {
        window.postMessage({type: SEND_DROPDOWN_MENU_SIZE, data: {width: document.body.scrollWidth, height: document.body.scrollHeight}}, window.location.href);
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.closeMenu);
    }

    handleClickOnDragHandle = (event: React.MouseEvent<HTMLDivElement>) => {
        if (this.state.isAnyDragging) {
            event.stopPropagation();
        }
    }

    editServer = (team: string) => {
        return (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            window.postMessage({type: SHOW_EDIT_SERVER_MODAL, data: {name: team}}, window.location.href);
            this.closeMenu();
        };
    }

    removeServer = (team: string) => {
        return (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            window.postMessage({type: SHOW_REMOVE_SERVER_MODAL, data: {name: team}}, window.location.href);
            this.closeMenu();
        };
    }

    render() {
        return (
            <div
                onClick={this.preventPropogation}
                className={classNames('TeamDropdown', {
                    darkMode: this.state.darkMode,
                })}
            >
                <div className='TeamDropdown__header'>
                    <span>{'Servers'}</span>
                </div>
                <hr className='TeamDropdown__divider'/>
                <DragDropContext
                    onDragStart={this.onDragStart}
                    onDragEnd={this.onDragEnd}
                >
                    <Droppable
                        isDropDisabled={this.state.hasGPOTeams}
                        droppableId='TeamDropdown__droppable'
                    >
                        {(provided) => (
                            <div
                                className='TeamDropdown__droppable'
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                            >
                                {this.state.orderedTeams?.map((team, orderedIndex) => {
                                    const index = this.state.teams?.indexOf(team);
                                    const {sessionExpired, hasUnreads, mentionCount} = team.tabs.reduce((counts, tab) => {
                                        const tabName = getTabViewName(team.name, tab.name);
                                        counts.sessionExpired = this.state.expired?.get(tabName) || counts.sessionExpired;
                                        counts.hasUnreads = this.state.unreads?.get(tabName) || counts.hasUnreads;
                                        counts.mentionCount += this.state.mentions?.get(tabName) || 0;
                                        return counts;
                                    }, {sessionExpired: false, hasUnreads: false, mentionCount: 0});

                                    let badgeDiv: React.ReactNode;
                                    if (sessionExpired) {
                                        badgeDiv = (
                                            <div className='TeamDropdown__badge-expired'>
                                                <i className='icon-alert-circle-outline'/>
                                            </div>
                                        );
                                    } else if (mentionCount && mentionCount > 0) {
                                        badgeDiv = (
                                            <div className='TeamDropdown__badge-count'>
                                                <span>{mentionCount > 99 ? '99+' : mentionCount}</span>
                                            </div>
                                        );
                                    } else if (hasUnreads) {
                                        badgeDiv = (
                                            <div className='TeamDropdown__badge-dot'/>
                                        );
                                    }

                                    return (
                                        <Draggable
                                            key={index}
                                            draggableId={`TeamDropdown__draggable-${index}`}
                                            index={orderedIndex}
                                            disableInteractiveElementBlocking={true}
                                        >
                                            {(provided, snapshot) => (
                                                <button
                                                    className={classNames('TeamDropdown__button', {
                                                        dragging: snapshot.isDragging,
                                                        anyDragging: this.state.isAnyDragging,
                                                        active: this.isActiveTeam(team),
                                                    })}
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    onClick={this.selectServer(team)}
                                                    style={getStyle(provided.draggableProps.style)}
                                                >
                                                    <div
                                                        className={classNames('TeamDropdown__draggable-handle', {
                                                            dragging: snapshot.isDragging,
                                                        })}
                                                        {...provided.dragHandleProps}
                                                        onClick={this.handleClickOnDragHandle}
                                                    >
                                                        <i className='icon-drag-vertical'/>
                                                        {this.isActiveTeam(team) ? <i className='icon-check'/> : <i className='icon-server-variant'/>}
                                                        <span>{team.name}</span>
                                                    </div>
                                                    <div className='TeamDropdown__indicators'>
                                                        <button
                                                            className='TeamDropdown__button-edit'
                                                            onClick={this.editServer(team.name)}
                                                        >
                                                            <i className='icon-pencil-outline'/>
                                                        </button>
                                                        <button
                                                            className='TeamDropdown__button-remove'
                                                            onClick={this.removeServer(team.name)}
                                                        >
                                                            <i className='icon-trash-can-outline'/>
                                                        </button>
                                                        {badgeDiv && <div className='TeamDropdown__badge'>
                                                            {badgeDiv}
                                                        </div>}
                                                    </div>
                                                </button>
                                            )}
                                        </Draggable>
                                    );
                                })}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
                <hr className='TeamDropdown__divider'/>
                {this.state.enableServerManagement &&
                    <button
                        className='TeamDropdown__button addServer'
                        onClick={this.addServer}
                    >
                        <i className='icon-plus'/>
                        <span>{'Add a server'}</span>
                    </button>
                }
            </div>
        );
    }
}

ReactDOM.render(
    <TeamDropdown/>,
    document.getElementById('app'),
);
