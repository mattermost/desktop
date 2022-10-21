// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log from 'electron-log';

export class WebRequestHandler<T, T2> {
    listeners: Map<string, (details: T) => T2>;
    modifyCallbackObject: (details: T, callbackObject: T2, result: T2) => T2;

    constructor(modifyCallbackObject: (details: T, callbackObject: T2, result: T2) => T2) {
        this.listeners = new Map();
        this.modifyCallbackObject = modifyCallbackObject;
    }

    setListener = (
        id: string,
        listener: (details: T) => T2,
    ) => {
        this.listeners.set(id, listener);
    }

    removeListener = (id: string) => {
        this.listeners.delete(id);
    }

    handle = (details: T, callback?: (response: T2) => void) => {
        log.silly('webRequestHandler.handle', details);

        if (!this.listeners.size) {
            callback?.({} as T2);
            return;
        }

        let callbackObject = {} as T2;

        for (const id of this.listeners.keys()) {
            if (this.listeners.has(id)) {
                const listener = this.listeners.get(id)!;
                const result = listener(details);

                callbackObject = this.modifyCallbackObject(details, callbackObject, result);
            }
        }

        log.silly('webRequestHandler.handle result', callbackObject);

        callback?.(callbackObject);
    }
}
