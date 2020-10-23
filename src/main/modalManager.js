// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';

import {ModalView} from './modalView';

// this file is expected to be treated like a singleton, so load it like:
// import * as modalManager from '<path>/modalManager';

let modalQueue = [];

// TODO: use a key to prevent duplication of modals? like calling multiple times the add server
// should we return the original promise if called multiple times with the same key?
export function addModal(html, preload, data, win) {
  const modalPromise = new Promise((resolve, reject) => {
    const mv = new ModalView(html, preload, data, resolve, reject, win);
    modalQueue.push(mv);
  });

  if (modalQueue.length === 1) {
    showModal();
  }

  return modalPromise;
}

ipcMain.handle('retrieve-modal-info', handleInfoRequest);
ipcMain.on('modal-result', handleModalResult);
ipcMain.on('modal-cancel', handleModalCancel);

function findModalByCaller(event) {
  if (modalQueue.length) {
    const requestModal = modalQueue.find((modal) => {
      return (modal.view && modal.view.webContents && modal.view.webContents.id === event.sender.id);
    });
    return requestModal;
  }
  return null;
}

function handleInfoRequest(event) {
  const requestModal = findModalByCaller(event);
  if (requestModal) {
    return requestModal.handleInfoRequest();
  }
  return null;
}

export function showModal() {
  modalQueue.forEach((modal, index) => {
    if (index === 0) {
      modal.show();
    }
    modal.hide();
  });
}

function handleModalResult(event, data) {
  const requestModal = this.findModalByCaller(event);
  if (requestModal) {
    requestModal.resolve(data);
    filterActive();
  }
}

function handleModalCancel(event, data) {
  const requestModal = this.findModalByCaller(event);
  if (requestModal) {
    requestModal.reject(data);
    filterActive();
  }
}

function filterActive() {
  modalQueue = modalQueue.filter((modal) => modal.isActive());
}

export default {
  addModal,
  showModal,
};