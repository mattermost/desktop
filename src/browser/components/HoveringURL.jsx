const React = require('react');
const PropTypes = require('prop-types');

function HoveringURL(props) {
  if (props.targetURL.startsWith(props.currentTeamURL)) {
    return <div/>;
  }

  return (
    <div className='HoveringURL HoveringURL-left'>
      {props.targetURL}
    </div>
  );
}

HoveringURL.propTypes = {
  currentTeamURL: PropTypes.string,
  targetURL: PropTypes.string,
};

module.exports = HoveringURL;
