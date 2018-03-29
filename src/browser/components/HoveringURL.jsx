const React = require('react');
const PropTypes = require('prop-types');

function HoveringURL(props) {
  return (
    <div className='HoveringURL HoveringURL-left'>
      {props.targetURL}
    </div>
  );
}

HoveringURL.propTypes = {
  targetURL: PropTypes.string,
};

module.exports = HoveringURL;
