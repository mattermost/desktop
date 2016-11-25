const React = require('react');

const divStyle = {
  backgroundColor: 'whitesmoke',
  position: 'absolute',
  bottom: 0,
  paddingLeft: 4,
  paddingRight: 16,
  borderTopRightRadius: 4
};

const spanStyle = {
  color: 'gray'
};

class HoveringURL extends React.Component {
  render() {
    return (
      <div style={divStyle}>
        <span style={spanStyle}>
          {this.props.targetURL}
        </span>
      </div>
    );
  }
}

HoveringURL.propTypes = {
  targetURL: React.PropTypes.string
};

module.exports = HoveringURL;
