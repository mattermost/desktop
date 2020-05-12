// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {ipcRenderer} from 'electron';

// this component is used to override some checks from the UI, leaving only to trust the protocol in case it wasn't http/s
// it is used the same as an `a` JSX tag
export default function ExternalLink(props) {
  const click = (e) => {
    e.preventDefault();
    let parseUrl;
    try {
      parseUrl = new URL(props.href);
      ipcRenderer.send('confirm-protocol', parseUrl.protocol, props.href);
    } catch (err) {
      console.error(`invalid url ${props.href} supplied to externallink: ${err}`);
    }
  };
  const options = {
    onClick: click,
    ...props,
  };
  return (
    <a {...options}/>
  );
}

ExternalLink.propTypes = {
  href: PropTypes.string.isRequired,
};