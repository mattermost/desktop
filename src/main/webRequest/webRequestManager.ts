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
import log from 'electron-log';

import {RequestHeaders, ResponseHeaders} from 'types/webRequest';

import {WebRequestHandler} from 'main/webRequest/webRequestHandler';

export class WebRequestManager {
    private onBeforeRequest: WebRequestHandler<OnBeforeRequestListenerDetails, CallbackResponse>;
    private onBeforeSendHeaders: WebRequestHandler<OnBeforeSendHeadersListenerDetails, BeforeSendResponse>;
    private onHeadersReceived: WebRequestHandler<OnHeadersReceivedListenerDetails, HeadersReceivedResponse>;

    constructor() {
        this.onBeforeRequest = new WebRequestHandler(this.onBeforeRequestCallback);
        this.onBeforeSendHeaders = new WebRequestHandler(this.onBeforeSendHeadersCallback);
        this.onHeadersReceived = new WebRequestHandler(this.onHeadersReceivedCallback);
    }

    initialize = () => {
        session.defaultSession.webRequest.onBeforeRequest(this.onBeforeRequest.handleWebRequest);
        session.defaultSession.webRequest.onBeforeSendHeaders(this.onBeforeSendHeaders.handleWebRequest);
        session.defaultSession.webRequest.onHeadersReceived(this.onHeadersReceived.handleWebRequest);
    }

    rewriteURL = (regex: RegExp, replacement: string, webContentsId?: number) => {
        log.debug('WebRequestManager.rewriteURL', regex, replacement, webContentsId);

        // Purge old listeners since we shouldn't be rewriting the same regex from 2 listeners
        const eventName = `rewriteURL_${regex}_${webContentsId ?? '*'}`;
        if (this.onBeforeRequest.eventNames().includes(eventName)) {
            this.onBeforeRequest.removeAllListeners(eventName);
        }

        this.onBeforeRequest.addWebRequestListener(eventName, (details) => {
            if (webContentsId && details.webContentsId !== webContentsId) {
                return {};
            }

            if (!details.url.match(regex)) {
                return {};
            }

            log.silly('WebRequestManager.rewriteURL success', webContentsId, details.url, details.url.replace(regex, replacement));
            return {redirectURL: details.url.replace(regex, replacement)};
        });
    }

    onRequestHeaders = (listener: (headers: RequestHeaders) => RequestHeaders, webContentsId?: number) => {
        log.debug('WebRequestManager.onRequestHeaders', webContentsId);

        this.onBeforeSendHeaders.addWebRequestListener(`onRequestHeaders_${webContentsId ?? '*'}`, (details) => {
            if (webContentsId && details.webContentsId !== webContentsId) {
                return {};
            }

            if (!details.requestHeaders) {
                return {};
            }

            return {requestHeaders: listener(details.requestHeaders)};
        });
    };

    onResponseHeaders = (listener: (headers: ResponseHeaders) => ResponseHeaders, webContentsId?: number) => {
        log.debug('WebRequestManager.onResponseHeaders', webContentsId);

        this.onHeadersReceived.addWebRequestListener(`onResponseHeaders_${webContentsId ?? '*'}`, (details) => {
            if (webContentsId && details.webContentsId !== webContentsId) {
                return {};
            }

            if (!details.responseHeaders) {
                return {};
            }

            return {responseHeaders: listener(details.responseHeaders)};
        });
    };

    private onBeforeRequestCallback = (
        details: OnBeforeRequestListenerDetails,
        callbackObject: CallbackResponse,
        result: CallbackResponse,
    ): CallbackResponse => {
        if (result.redirectURL && callbackObject.redirectURL) {
            throw new Error(`Listeners produced more than one redirect URL for ${details.url}: ${result.redirectURL} ${callbackObject.redirectURL}`);
        }
        const modifiedCallbackObject: CallbackResponse = {...callbackObject};
        if (result.cancel) {
            modifiedCallbackObject.cancel = result.cancel;
        }
        if (result.redirectURL) {
            modifiedCallbackObject.redirectURL = result.redirectURL;
        }
        return modifiedCallbackObject;
    }

    private onBeforeSendHeadersCallback = (
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

    private onHeadersReceivedCallback = (
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
