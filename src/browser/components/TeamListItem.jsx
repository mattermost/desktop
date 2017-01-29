const React = require('react');

class TeamListItem extends React.Component {
  constructor(props) {
    super(props);
    this.handleTeamRemove = this.handleTeamRemove.bind(this);
    this.handleTeamEditing = this.handleTeamEditing.bind(this);
  }

  handleTeamRemove() {
    this.props.onTeamRemove();
  }
  handleTeamEditing() {
    this.props.onTeamEditing();
  }
  render() {
    var style = {
      left: {
        display: 'inline-block',
        cursor: 'pointer'
      }
    };
    return (
      <div className='teamListItem list-group-item'>
        <div
          style={style.left}
          onClick={this.props.onTeamClick}
        >
          <h4 className='list-group-item-heading'>{ this.props.name }</h4>
          <p className='list-group-item-text'>
            { this.props.url }
          </p>
        </div>
        <div className='pull-right'>
          <a
            href='#'
            onClick={this.handleTeamEditing}
          >{'Edit'}</a>
          {' - '}
          <a
            href='#'
            onClick={this.handleTeamRemove}
          >{'Remove'}</a>
        </div>
      </div>
    );
  }
}

TeamListItem.propTypes = {
  name: React.PropTypes.string,
  onTeamEditing: React.PropTypes.func,
  onTeamRemove: React.PropTypes.func,
  onTeamClick: React.PropTypes.func,
  url: React.PropTypes.string
};

module.exports = TeamListItem;
