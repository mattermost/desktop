const React = require('react');

const style = {
  color: 'gray',
  backgroundColor: 'whitesmoke',
  maxWidth: '95%',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  position: 'absolute',
  bottom: 0,
  paddingLeft: 4,
  paddingRight: 16,
  paddingTop: 2,
  paddingBottom: 2,
  borderTopRightRadius: 4,
  borderTop: 'solid thin lightgray',
  borderRight: 'solid thin lightgray'
};

class HoveringURL extends React.Component {
  render() {
    return (
      <div style={style}>
        {this.props.targetURL}
      </div>
    );
  }
}

HoveringURL.propTypes = {
  targetURL: React.PropTypes.string
};

module.exports = HoveringURL;
