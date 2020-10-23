// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
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
