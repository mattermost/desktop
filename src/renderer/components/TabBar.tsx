// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Nav, NavItem, NavLink} from 'react-bootstrap';
import {Container, Draggable, OnDropCallback} from 'react-smooth-dnd';
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
    onDrop: OnDropCallback;
    tabsDisabled?: boolean;
};

type State = {
    hasGPOTeams: boolean;
};

export default class TabBar extends React.PureComponent<Props, State> { // need "this"
    container?: React.RefObject<Container>;

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
        const tabs = orderedTabs.map((team) => {
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

            const id = `teamTabItem${index}`;
            const navItem = () => (
                <NavItem
                    as='li'
                    key={index}
                    id={id}
                    draggable={false}
                    onMouseDown={() => {
                        if (!this.props.tabsDisabled) {
                            this.props.onSelect(team.name, index);
                        }
                    }}
                    title={team.name}
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
            );

            return (
                <Draggable
                    key={id}
                    render={navItem}
                    className={classNames('teamTabItem', {
                        active: this.props.activeKey === index,
                    })}
                />);
        });
        if (this.props.showAddServerButton === true) {
            tabs.push(
                <NavItem
                    as='li'
                    className='TabBar-addServerButton'
                    key='addServerButton'
                    id='addServerButton'
                    draggable={false}
                    title='Add new server'
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
                </NavItem>,
            );
        }

        const navContainer = (ref: React.RefObject<HTMLDivElement>) => (
            <Nav
                ref={ref}
                className={`smooth-dnd-container TabBar${this.props.isDarkMode ? ' darkMode' : ''}`}
                id={this.props.id}
                variant='tabs'
            >
                { tabs }
            </Nav>
        );
        return (
            <Container
                ref={this.container}
                render={navContainer}
                orientation='horizontal'
                lockAxis={'x'}
                onDrop={this.props.onDrop}
                animationDuration={300}
                shouldAcceptDrop={() => {
                    return !this.state.hasGPOTeams && !this.props.tabsDisabled;
                }}
            />
        );
    }
}
