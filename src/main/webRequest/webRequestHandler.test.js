// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebRequestHandler} from './webRequestHandler';

jest.mock('electron-log', () => ({
    silly: jest.fn(),
}));

describe('main/webRequest/webRequestHandler', () => {
    it('should not iterate through listeners when size is < 1', () => {
        const handler = new WebRequestHandler();
        handler.listeners = {
            size: 0,
            keys: jest.fn(),
        };

        const callback = jest.fn();
        handler.handle({}, callback);
        expect(handler.listeners.keys).not.toBeCalled();
        expect(callback).toBeCalledWith({});

        handler.listeners = {
            size: 1,
            keys: jest.fn().mockReturnValue([]),
        };

        handler.handle();
        expect(handler.listeners.keys).toBeCalled();
    });

    it('should call each listener in the sequence they were added', () => {
        const modifyCallbackObject = jest.fn();
        const handler = new WebRequestHandler(modifyCallbackObject);

        let result = '';

        const listener1 = jest.fn().mockImplementation(() => {
            result += 'listener1';
        });
        handler.setListener('listener1', listener1);
        const listener2 = jest.fn().mockImplementation(() => {
            result += 'listener2';
        });
        handler.setListener('listener2', listener2);
        const listener3 = jest.fn().mockImplementation(() => {
            result += 'listener3';
        });
        handler.setListener('listener3', listener3);

        const details = {some: 'detail'};
        const callback = jest.fn();
        handler.handle(details, callback);

        expect(listener1).toHaveBeenCalledWith(details);
        expect(listener2).toHaveBeenCalledWith(details);
        expect(listener3).toHaveBeenCalledWith(details);
        expect(result).toBe('listener1listener2listener3');
    });

    it('should modify the callback object and call the webRequest with the compiled object', () => {
        const modifyCallbackObject = jest.fn().mockImplementation((details, callbackObject, result) => ({
            ...callbackObject,
            ...result,
        }));
        const handler = new WebRequestHandler(modifyCallbackObject);

        const listener1 = jest.fn().mockImplementation(() => ({listener1: true}));
        handler.setListener('listener1', listener1);
        const listener2 = jest.fn().mockImplementation(() => ({listener2: true}));
        handler.setListener('listener2', listener2);
        const listener3 = jest.fn().mockImplementation(() => ({listener3: false}));
        handler.setListener('listener3', listener3);

        const details = {some: 'detail'};
        const callback = jest.fn();
        handler.handle(details, callback);

        expect(callback).toHaveBeenCalledWith({
            listener1: true,
            listener2: true,
            listener3: false,
        });
    });
});
