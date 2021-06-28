// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Nav, NavItem} from 'react-bootstrap';
import {Container, Draggable, OnDropCallback} from 'react-smooth-dnd';
import PlusIcon from 'mdi-react/PlusIcon';

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
                    key={index}
                    id={id}
                    eventKey={index}
                    draggable={false}
                    ref={id}
                    active={this.props.activeKey === index}
                    onMouseDown={() => {
                        this.props.onSelect(team.name, index);
                    }}
                    onSelect={() => {
                        this.props.onSelect(team.name, index);
                    }}
                    title={team.name}
                    disabled={this.props.tabsDisabled}
                >
                    <div className='TabBar-tabSeperator'>
                        <span>
                            {team.name}
                        </span>
                        { badgeDiv }
                    </div>
                </NavItem>
            );

            return (
                <Draggable
                    key={id}
                    render={navItem}
                    className='teamTabItem'
                />);
        });
        if (this.props.showAddServerButton === true) {
            tabs.push(
                <NavItem
                    className='TabBar-addServerButton'
                    key='addServerButton'
                    id='addServerButton'
                    eventKey='addServerButton'
                    draggable={false}
                    title='Add new server'
                    onSelect={() => {
                        this.props.onAddServer();
                    }}
                    disabled={this.props.tabsDisabled}
                >
                    <div className='TabBar-tabSeperator'>
                        <PlusIcon size={20}/>
                    </div>
                </NavItem>,
            );
        }

        const navContainer = (ref: React.RefObject<Nav>) => (
            <Nav
                ref={ref}
                className={`smooth-dnd-container TabBar${this.props.isDarkMode ? ' darkMode' : ''}`}
                id={this.props.id}
                bsStyle='tabs'
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
