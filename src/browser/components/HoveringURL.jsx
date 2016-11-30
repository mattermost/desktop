const React = require('react');

class HoveringURL extends React.Component {
  render() {
    return (
      <div style={this.props.style}>
        {this.props.targetURL}
      </div>
    );
  }
}

HoveringURL.propTypes = {
  style: React.PropTypes.object,
  targetURL: React.PropTypes.string
};

module.exports = HoveringURL;
