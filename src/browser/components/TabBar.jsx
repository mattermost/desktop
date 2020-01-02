// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import {remote} from 'electron';
import PropTypes from 'prop-types';
import {Nav, NavItem} from 'react-bootstrap';
import {Container, Draggable} from 'react-smooth-dnd';
import PlusIcon from 'mdi-react/PlusIcon';

export default class TabBar extends React.Component { // need "this"
  render() {
    const orderedTabs = this.props.teams.concat().sort((a, b) => a.order - b.order);
    const tabs = orderedTabs.map((team) => {
      const index = this.props.teams.indexOf(team);
      const sessionExpired = this.props.sessionsExpired[index];

      let unreadCount = 0;
      if (this.props.unreadCounts[index] > 0) {
        unreadCount = this.props.unreadCounts[index];
      }
      if (this.props.unreadAtActive[index]) {
        unreadCount += 1;
      }

      let mentionCount = 0;
      if (this.props.mentionCounts[index] > 0) {
        mentionCount = this.props.mentionCounts[index];
      }
      if (this.props.mentionAtActiveCounts[index] > 0) {
        mentionCount += this.props.mentionAtActiveCounts[index];
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
      } else if (unreadCount !== 0) {
        badgeDiv = (
          <div className='TabBar-dot'/>
        );
      }

      const id = `teamTabItem${index}`;
      const navItem = () => (
        <NavItem
          key={id}
          id={id}
          eventKey={index}
          draggable={false}
          ref={id}
          active={this.props.activeKey === index}
          activeKey={this.props.activeKey}
          onMouseDown={() => {
            this.props.onSelect(index);
          }}
          onSelect={() => {
            this.props.onSelect(index);
          }}
          title={team.name}
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
        >
          <div className='TabBar-tabSeperator'>
            <PlusIcon size={20}/>
          </div>
        </NavItem>
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
          return !(remote.getCurrentWindow().registryConfigData.teams && remote.getCurrentWindow().registryConfigData.teams.length > 0);
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
  sessionsExpired: PropTypes.array,
  unreadCounts: PropTypes.array,
  unreadAtActive: PropTypes.array,
  mentionCounts: PropTypes.array,
  mentionAtActiveCounts: PropTypes.array,
  showAddServerButton: PropTypes.bool,
  onAddServer: PropTypes.func,
  onDrop: PropTypes.func,
};
