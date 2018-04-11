import React from 'react';
import PropTypes from 'prop-types';

export default function HoveringURL(props) {
  return (
    <div className='HoveringURL HoveringURL-left'>
      {props.targetURL}
    </div>
  );
}

HoveringURL.propTypes = {
  targetURL: PropTypes.string,
};
