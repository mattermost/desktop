// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    BeforeSendResponse,
    CallbackResponse,
    HeadersReceivedResponse,
    OnBeforeRequestListenerDetails,
    OnBeforeSendHeadersListenerDetails,
    OnHeadersReceivedListenerDetails,
    session,
} from 'electron';

import {WebRequestHandler} from 'main/webRequest/webRequestHandler';

export class WebRequestManager {
    onBeforeRequest: WebRequestHandler<OnBeforeRequestListenerDetails, CallbackResponse>;
    onBeforeSendHeaders: WebRequestHandler<OnBeforeSendHeadersListenerDetails, BeforeSendResponse>;
    onHeadersReceived: WebRequestHandler<OnHeadersReceivedListenerDetails, HeadersReceivedResponse>;

    constructor() {
        this.onBeforeRequest = new WebRequestHandler(this.onBeforeRequestCallback);
        this.onBeforeSendHeaders = new WebRequestHandler(this.onBeforeSendHeadersCallback);
        this.onHeadersReceived = new WebRequestHandler(this.onHeadersReceivedCallback);
    }

    initialize = () => {
        session.defaultSession.webRequest.onBeforeRequest(this.onBeforeRequest.handle);
        session.defaultSession.webRequest.onBeforeSendHeaders(this.onBeforeSendHeaders.handle);
        session.defaultSession.webRequest.onHeadersReceived(this.onHeadersReceived.handle);
    }

    onBeforeRequestCallback = (
        details: OnBeforeRequestListenerDetails,
        callbackObject: CallbackResponse,
        result: CallbackResponse,
    ): CallbackResponse => {
        if (result.redirectURL && callbackObject.redirectURL) {
            throw new Error(`Listeners produced more than one redirect URL: ${result.redirectURL} ${callbackObject.redirectURL}`);
        }
        const modifiedCallbackObject: CallbackResponse = {};
        if (result.cancel) {
            modifiedCallbackObject.cancel = result.cancel;
        }
        if (result.redirectURL) {
            modifiedCallbackObject.redirectURL = result.redirectURL;
        }
        return modifiedCallbackObject;
    }

    onBeforeSendHeadersCallback = (
        details: OnBeforeSendHeadersListenerDetails,
        callbackObject: BeforeSendResponse,
        result: BeforeSendResponse,
    ): BeforeSendResponse => {
        const modifiedCallbackObject: BeforeSendResponse = {
            requestHeaders: {
                ...details.requestHeaders,
                ...callbackObject.requestHeaders,
                ...result.requestHeaders,
            },
        };
        if (result.cancel) {
            modifiedCallbackObject.cancel = result.cancel;
        }
        return modifiedCallbackObject;
    }

    onHeadersReceivedCallback = (
        details: OnHeadersReceivedListenerDetails,
        callbackObject: HeadersReceivedResponse,
        result: HeadersReceivedResponse,
    ): HeadersReceivedResponse => {
        const modifiedCallbackObject: HeadersReceivedResponse = {
            responseHeaders: {
                ...details.responseHeaders,
                ...callbackObject.responseHeaders,
                ...result.responseHeaders,
            },
        };
        if (result.cancel) {
            modifiedCallbackObject.cancel = result.cancel;
        }
        return modifiedCallbackObject;
    }
}

const webRequestManager = new WebRequestManager();
export default webRequestManager;
