const React = require('react');
const PropTypes = require('prop-types');

function HoveringURL(props) {
  return (
    <div style={props.style}>
      {props.targetURL}
    </div>
  );
}

HoveringURL.propTypes = {
  style: PropTypes.object,
  targetURL: PropTypes.string
};

module.exports = HoveringURL;
