// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import propTypes from 'prop-types';

export default function UrlDescription(props) {
  return (
    <div className='urlDescription'>
      <p>{props.url}</p>
    </div>
  );
}

UrlDescription.propTypes = {
  url: propTypes.string.isRequired
};