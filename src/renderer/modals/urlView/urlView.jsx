// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'renderer/css/modals.css';

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

import React from 'react';
import ReactDOM from 'react-dom';

import UrlDescription from '../../components/urlDescription.jsx';

const start = async () => {
  console.log(queryString);
  console.log(urlParams);
  console.log(urlParams.get('url'));
  ReactDOM.render(
    <UrlDescription
      url={decodeURIComponent(urlParams.get('url'))}
    />,
    document.getElementById('app')
  );
};

start();