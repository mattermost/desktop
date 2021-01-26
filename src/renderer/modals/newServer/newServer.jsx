// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';
//import 'renderer/css/components/AddServerModal.css';

// todo: add css into modal;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

import React from 'react';
import ReactDOM from 'react-dom';

import {MODAL_CANCEL, MODAL_RESULT} from 'common/communication.js';

import NewTeamModal from '../../components/NewTeamModal.jsx'; //'./addServer.jsx';

const onClose = () => {
  window.postMessage({type: MODAL_CANCEL}, window.location.href);
};

const onSave = (data) => {
  window.postMessage({type: MODAL_RESULT, data}, window.location.href);
};

const start = async () => {
  ReactDOM.render(
    <NewTeamModal
      onClose={onClose}
      onSave={onSave}
      editMode={false}
      show={true}
      url={decodeURIComponent(urlParams.get('url'))}
    />,
    document.getElementById('app')
  );
};

start();

/** remove
 * NewTeamModal.propTypes = {
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  team: PropTypes.object,
  editMode: PropTypes.bool,
  show: PropTypes.bool,
  restoreFocus: PropTypes.bool,
  currentOrder: PropTypes.number,
  setInputRef: PropTypes.func,
};

 */
