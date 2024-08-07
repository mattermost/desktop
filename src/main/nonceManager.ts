// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';
import type {IpcMainInvokeEvent} from 'electron';
import {v4 as uuid} from 'uuid';

import {GET_NONCE} from 'common/communication';

export class NonceManager {
    private nonces: Map<string, string>;

    constructor() {
        this.nonces = new Map();

        ipcMain.handle(GET_NONCE, this.handleGetNonce);
    }

    create = (url: string) => {
        const nonce = uuid();
        this.nonces.set(url, nonce);
        return nonce;
    };

    private handleGetNonce = (event: IpcMainInvokeEvent) => {
        const url = event.sender.getURL();
        const nonce = this.nonces.get(url);
        this.nonces.delete(url);
        return nonce;
    };
}

const nonceManager = new NonceManager();
export default nonceManager;
