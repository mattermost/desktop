const React = require('react');
const PropTypes = require('prop-types');
const {Glyphicon, Nav, NavItem, Overlay} = require('react-bootstrap');

const PermissionRequestDialog = require('./PermissionRequestDialog.jsx');

class TabBar extends React.Component { // need "this"
  render() {
    const tabs = this.props.teams.map((team, index) => {
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
      if (mentionCount !== 0) {
        badgeDiv = (
          <div className='TabBar-badge'>
            {mentionCount}
          </div>);
      }
      const id = 'teamTabItem' + index;
      const requestingPermission = this.props.requestingPermission[index];
      const permissionOverlay = (
        <Overlay
          className='TabBar-permissionOverlay'
          placement='bottom'
          show={requestingPermission && this.props.activeKey === index}
          target={() => this.refs[id]}
        >
          <PermissionRequestDialog
            id={`${id}-permissionDialog`}
            origin={requestingPermission ? requestingPermission.origin : null}
            permission={requestingPermission ? requestingPermission.permission : null}
            onClickAllow={this.props.onClickPermissionDialog.bind(null, index, 'allow')}
            onClickBlock={this.props.onClickPermissionDialog.bind(null, index, 'block')}
            onClickClose={this.props.onClickPermissionDialog.bind(null, index, 'close')}
          />
        </Overlay>
      );
      return (
        <NavItem
          className='teamTabItem'
          key={id}
          id={id}
          eventKey={index}
          ref={id}
        >
          <span className={unreadCount === 0 ? '' : 'teamTabItem-label'}>{team.name}</span>
          { ' ' }
          { badgeDiv }
          {permissionOverlay}
        </NavItem>);
    });
    if (this.props.showAddServerButton === true) {
      tabs.push(
        <NavItem
          className='TabBar-addServerButton'
          key='addServerButton'
          id='addServerButton'
          eventKey='addServerButton'
          title='Add new server'
        >
          <Glyphicon glyph='plus'/>
        </NavItem>
      );
    }
    return (
      <Nav
        className='TabBar'
        id={this.props.id}
        bsStyle='tabs'
        activeKey={this.props.activeKey}
        onSelect={(eventKey) => {
          if (eventKey === 'addServerButton') {
            this.props.onAddServer();
          } else {
            this.props.onSelect(eventKey);
          }
        }}
      >
        { tabs }
      </Nav>
    );
  }
}

TabBar.propTypes = {
  activeKey: PropTypes.number,
  id: PropTypes.string,
  onSelect: PropTypes.func,
  teams: PropTypes.array,
  unreadCounts: PropTypes.array,
  unreadAtActive: PropTypes.array,
  mentionCounts: PropTypes.array,
  mentionAtActiveCounts: PropTypes.array,
  showAddServerButton: PropTypes.bool,
  requestingPermission: PropTypes.arrayOf(PropTypes.shape({
    origin: PropTypes.string,
    permission: PropTypes.string,
  })),
  onAddServer: PropTypes.func,
  onClickPermissionDialog: PropTypes.func,
};

module.exports = TabBar;
