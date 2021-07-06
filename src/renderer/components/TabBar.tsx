// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Nav, NavItem, NavLink} from 'react-bootstrap';
import {DragDropContext, Draggable, DraggingStyle, Droppable, DropResult, NotDraggingStyle} from 'react-beautiful-dnd';
import PlusIcon from 'mdi-react/PlusIcon';
import classNames from 'classnames';

import {Team} from 'types/config';

import {GET_CONFIGURATION} from 'common/communication';

type Props = {
    activeKey: number;
    id: string;
    isDarkMode: boolean;
    onSelect: (name: string, index: number) => void;
    teams: Team[];
    sessionsExpired: Record<string, boolean>;
    unreadCounts: Record<string, number>;
    mentionCounts: Record<string, number>;
    showAddServerButton: boolean;
    onAddServer: () => void;
    onDrop: (result: DropResult) => void;
    tabsDisabled?: boolean;
};

type State = {
    hasGPOTeams: boolean;
};

function getStyle(style?: DraggingStyle | NotDraggingStyle) {
    if (style?.transform) {
        const axisLockX = `${style.transform.slice(0, style.transform.indexOf(','))}, 0px)`;
        return {
            ...style,
            transform: axisLockX,
        };
    }
    return style;
}

export default class TabBar extends React.PureComponent<Props, State> { // need "this"
    constructor(props: Props) {
        super(props);
        this.state = {
            hasGPOTeams: false,
        };
    }

    componentDidMount() {
        window.ipcRenderer.invoke(GET_CONFIGURATION).then((config) => {
            this.setState({hasGPOTeams: config.registryTeams && config.registryTeams.length > 0});
        });
    }

    render() {
        const orderedTabs = this.props.teams.concat().sort((a, b) => a.order - b.order);
        const tabs = orderedTabs.map((team, orderedIndex) => {
            const index = this.props.teams.indexOf(team);

            const sessionExpired = this.props.sessionsExpired[index];
            const hasUnreads = this.props.unreadCounts[index];

            let mentionCount = 0;
            if (this.props.mentionCounts[index] > 0) {
                mentionCount = this.props.mentionCounts[index];
            }

            let badgeDiv: React.ReactNode;
            if (sessionExpired) {
                badgeDiv = (
                    <div className='TabBar-expired'/>
                );
            } else if (mentionCount !== 0) {
                badgeDiv = (
                    <div className='TabBar-badge'>
                        {mentionCount}
                    </div>
                );
            } else if (hasUnreads) {
                badgeDiv = (
                    <div className='TabBar-dot'/>
                );
            }

            return (
                <Draggable
                    key={index}
                    draggableId={`teamTabItem${index}`}
                    index={orderedIndex}
                >
                    {(provided, snapshot) => (
                        <NavItem
                            ref={provided.innerRef}
                            as='li'
                            id={`teamTabItem${index}`}
                            draggable={false}
                            title={team.name}
                            className={classNames('teamTabItem', {
                                active: this.props.activeKey === index,
                                dragging: snapshot.isDragging,
                            })}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={getStyle(provided.draggableProps.style)}
                        >
                            <NavLink
                                eventKey={index}
                                draggable={false}
                                active={this.props.activeKey === index}
                                disabled={this.props.tabsDisabled}
                                onSelect={() => {
                                    this.props.onSelect(team.name, index);
                                }}
                            >
                                <div className='TabBar-tabSeperator'>
                                    <span>
                                        {team.name}
                                    </span>
                                    { badgeDiv }
                                </div>
                            </NavLink>
                        </NavItem>
                    )}
                </Draggable>
            );
        });
        if (this.props.showAddServerButton === true) {
            tabs.push(
                <Draggable
                    draggableId={'TabBar-addServerButton'}
                    index={this.props.teams.length}
                    isDragDisabled={true}
                >
                    {(provided) => (
                        <NavItem
                            ref={provided.innerRef}
                            as='li'
                            className='TabBar-addServerButton'
                            key='addServerButton'
                            id='addServerButton'
                            draggable={false}
                            title='Add new server'
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                        >
                            <NavLink
                                eventKey='addServerButton'
                                draggable={false}
                                disabled={this.props.tabsDisabled}
                                onSelect={() => {
                                    this.props.onAddServer();
                                }}
                            >
                                <div className='TabBar-tabSeperator'>
                                    <PlusIcon size={20}/>
                                </div>
                            </NavLink>
                        </NavItem>
                    )}
                </Draggable>,
            );
        }

        return (
            <DragDropContext onDragEnd={this.props.onDrop}>
                <Droppable
                    isDropDisabled={this.state.hasGPOTeams || this.props.tabsDisabled}
                    droppableId='tabBar'
                    direction='horizontal'
                >
                    {(provided) => (
                        <Nav
                            ref={provided.innerRef}
                            className={`TabBar${this.props.isDarkMode ? ' darkMode' : ''}`}
                            id={this.props.id}
                            variant='tabs'
                            {...provided.droppableProps}
                        >
                            {tabs}
                            {provided.placeholder}
                        </Nav>
                    )}
                </Droppable>
            </DragDropContext>
        );
    }
}
