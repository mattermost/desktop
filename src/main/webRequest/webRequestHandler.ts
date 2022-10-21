// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';

import log from 'electron-log';

export class WebRequestHandler<T, T2> extends EventEmitter {
    modifyCallbackObject: (details: T, callbackObject: T2, result: T2) => T2;

    constructor(modifyCallbackObject: (details: T, callbackObject: T2, result: T2) => T2) {
        super();
        this.modifyCallbackObject = modifyCallbackObject;
    }

    handle = (details: T, callback?: (response: T2) => void) => {
        log.silly('webRequestHandler.handle', details);

        let callbackObject = {} as T2;

        for (const id of this.eventNames()) {
            for (const listener of this.listeners(id)) {
                const result = listener(details);

                callbackObject = this.modifyCallbackObject(details, callbackObject, result);
            }
        }

        log.silly('webRequestHandler.handle result', callbackObject);

        callback?.(callbackObject);
    }
}
