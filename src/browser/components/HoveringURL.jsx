const React = require('react');

function HoveringURL(props) {
  return (
    <div style={props.style}>
      {props.targetURL}
    </div>
  );
}

HoveringURL.propTypes = {
  style: React.PropTypes.object,
  targetURL: React.PropTypes.string
};

module.exports = HoveringURL;
