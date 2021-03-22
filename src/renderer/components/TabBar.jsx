// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import PropTypes from 'prop-types';
import {Nav, NavItem} from 'react-bootstrap';
import {Container, Draggable} from 'react-smooth-dnd';
import PlusIcon from 'mdi-react/PlusIcon';

import {GET_CONFIGURATION} from 'common/communication';

export default class TabBar extends React.PureComponent { // need "this"
    constructor(props) {
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

            let badgeDiv;
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
                    activeKey={this.props.activeKey}
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
                    activeKey={this.props.activeKey}
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

        const navContainer = (ref) => (
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

TabBar.propTypes = {
    activeKey: PropTypes.number,
    id: PropTypes.string,
    isDarkMode: PropTypes.bool,
    onSelect: PropTypes.func,
    teams: PropTypes.array,
    sessionsExpired: PropTypes.object,
    unreadCounts: PropTypes.object,
    mentionCounts: PropTypes.object,
    showAddServerButton: PropTypes.bool,
    onAddServer: PropTypes.func,
    onDrop: PropTypes.func,
    tabsDisabled: PropTypes.bool,
};
