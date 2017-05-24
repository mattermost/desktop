const React = require('react');
const PropTypes = require('prop-types');
const {Nav, NavItem, Button} = require('react-bootstrap');

function AddServerButton(props) {
  return (
    <NavItem
      className='AddServerButton'
      key='addServerButton'
      eventKey='addServerButton'
    >
      <Button
        id='tabBarAddNewTeam'
        onClick={props.onClick}
        className='AddServerButton-button'
        title='Add new server'
      >
        {'+'}
      </Button>
    </NavItem>
  );
}

AddServerButton.propTypes = {
  onClick: PropTypes.func
};

function TabBar(props) {
  const tabs = props.teams.map((team, index) => {
    let unreadCount = 0;
    if (props.unreadCounts[index] > 0) {
      unreadCount = props.unreadCounts[index];
    }
    if (props.unreadAtActive[index]) {
      unreadCount += 1;
    }

    let mentionCount = 0;
    if (props.mentionCounts[index] > 0) {
      mentionCount = props.mentionCounts[index];
    }
    if (props.mentionAtActiveCounts[index] > 0) {
      mentionCount += props.mentionAtActiveCounts[index];
    }

    let badgeDiv;
    if (mentionCount !== 0) {
      badgeDiv = (
        <div className='TabBar-badge'>
          {mentionCount}
        </div>);
    }
    const id = 'teamTabItem' + index;
    if (unreadCount === 0) {
      return (
        <NavItem
          className='teamTabItem'
          key={id}
          id={id}
          eventKey={index}
        >
          { team.name }
          { ' ' }
          { badgeDiv }
        </NavItem>);
    }
    return (
      <NavItem
        className='teamTabItem'
        key={id}
        id={id}
        eventKey={index}
      >
        <b>{ team.name }</b>
        { ' ' }
        { badgeDiv }
      </NavItem>);
  });
  return (
    <Nav
      className='TabBar'
      id={props.id}
      bsStyle='tabs'
      activeKey={props.activeKey}
      onSelect={props.onSelect}
    >
      { tabs }
      <AddServerButton onClick={props.onAddServer}/>
    </Nav>
  );
}

TabBar.propTypes = {
  activeKey: PropTypes.number,
  id: PropTypes.string,
  onSelect: PropTypes.func,
  teams: PropTypes.array,
  mentionCounts: PropTypes.array,
  mentionAtActiveCounts: PropTypes.array,
  onAddServer: PropTypes.func
};

module.exports = TabBar;
