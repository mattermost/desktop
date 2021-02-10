// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';
import 'renderer/css/components/HoveringURL.css';

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

import React from 'react';
import ReactDOM from 'react-dom';

import UrlDescription from '../../components/urlDescription.jsx';

const start = async () => {
  ReactDOM.render(
    <UrlDescription
      url={decodeURIComponent(urlParams.get('url'))}
    />,
    document.getElementById('app')
  );
};

start();
