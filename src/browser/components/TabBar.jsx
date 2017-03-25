const React = require('react');
const {Nav, NavItem, Button} = require('react-bootstrap');

class TabBar extends React.Component {
  render() {
    var self = this;
    var tabs = this.props.teams.map((team, index) => {
      var unreadCount = 0;
      var badgeStyle = {
        background: '#FF1744',
        float: 'right',
        color: 'white',
        minWidth: '19px',
        fontSize: '12px',
        textAlign: 'center',
        lineHeight: '20px',
        height: '19px',
        marginLeft: '5px',
        marginTop: '5px',
        borderRadius: '50%'
      };

      if (self.props.unreadCounts[index] > 0) {
        unreadCount = self.props.unreadCounts[index];
      }
      if (self.props.unreadAtActive[index]) {
        unreadCount += 1;
      }

      var mentionCount = 0;
      if (self.props.mentionCounts[index] > 0) {
        mentionCount = self.props.mentionCounts[index];
      }
      if (self.props.mentionAtActiveCounts[index] > 0) {
        mentionCount += self.props.mentionAtActiveCounts[index];
      }

      var badgeDiv;
      if (mentionCount !== 0) {
        badgeDiv = (
          <div style={badgeStyle}>
            {mentionCount}
          </div>);
      }
      var id = 'teamTabItem' + index;
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
        id={this.props.id}
        bsStyle='tabs'
        activeKey={this.props.activeKey}
        onSelect={this.props.onSelect}
      >
        { tabs }
        { this.renderAddTeamButton() }
      </Nav>
    );
  }

  renderAddTeamButton() {
    var tabButton = {
      border: 'none',
      fontSize: '20px',
      height: '31px',
      padding: '2px 0 0 0',
      width: '40px',
      color: '#999',
      fontWeight: 'bold',
      margin: '0',
      borderRadius: '2px 2px 0 0',
      outline: 'none'
    };

    return (
      <NavItem
        className='buttonTab'
        key='addServerButton'
        eventKey='addServerButton'
      >
        <Button
          id='tabBarAddNewTeam'
          onClick={this.props.onAddServer}
          style={tabButton}
          className='btn-tabButton'
          title='Add new server'
        >
          {'+'}
        </Button>
      </NavItem>
    );
  }
}

TabBar.propTypes = {
  activeKey: React.PropTypes.number,
  id: React.PropTypes.string,
  onSelect: React.PropTypes.func,
  teams: React.PropTypes.array,
  onAddServer: React.PropTypes.func
};

module.exports = TabBar;
