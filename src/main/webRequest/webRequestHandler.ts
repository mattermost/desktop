// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';

import log from 'electron-log';

export class WebRequestHandler<T, T2> extends EventEmitter {
    protected modifyCallbackObject: (details: T, callbackObject: T2, result: T2) => T2;

    constructor(modifyCallbackObject: (details: T, callbackObject: T2, result: T2) => T2) {
        super();
        this.modifyCallbackObject = modifyCallbackObject;
    }

    handleWebRequest = (details: T, callback?: (response: T2) => void) => {
        log.silly('webRequestHandler.handle', details);

        let callbackObject = {} as T2;
        const modify = (result: T2) => {
            callbackObject = {...callbackObject, ...this.modifyCallbackObject(details, callbackObject, result)};
        };

        for (const id of this.eventNames()) {
            this.emit(id, details, (result: T2) => modify(result));
        }

        log.silly('webRequestHandler.handle result', callbackObject);

        callback?.(callbackObject);
    }

    addWebRequestListener = (name: string, listener: (details: T) => T2) => {
        this.on(name, (details: T, callback: (result: T2) => void) => callback(listener(details)));
    };
}
