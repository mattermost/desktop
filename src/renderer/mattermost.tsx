// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {createHashHistory} from 'history';

import('mattermost_webapp/styles');

const LazyApp = React.lazy(() => import('mattermost_webapp/app'));
const MattermostAppComponent = (props: any) => (
    <React.Suspense fallback={<div>{'Loading...'}</div>}>
        <LazyApp {...props}/>
    </React.Suspense>
);
MattermostAppComponent.displayName = 'App';

type State = {
    appReady: boolean;
};

class MattermostApp extends React.PureComponent<any, State> {
    registry?: {
        getModule: <T>(name: string) => T;
        setModule: <T>(name: string, component: T) => boolean;
    }

    constructor(props: any) {
        super(props);

        this.state = {
            appReady: false,
        };
    }

    async componentDidMount() {
        this.registry = await import('mattermost_webapp/registry');
        this.registry?.setModule<History>('utils/browser_history', createHashHistory());

        // Websocket site url handling
        const currentURL = await window.mattermost.getUrl;
        this.registry?.setModule<() => string>('utils/url/getSiteURL', () => currentURL);

        // Cookie handling
        const cookies = await window.mattermost.setupCookies;
        Object.defineProperty(document, 'cookie', {
            get() {
                return this.value || '';
            },
            set(cookie) {
                if (!cookie) {
                    return '';
                }
                window.mattermost.setCookie(cookie);
                const cutoff = cookie.indexOf(';');
                const pair = cookie.substring(0, cutoff >= 0 ? cutoff : cookie.length);
                const bits = pair.split('=');
                const cookies = this.value ? this.value.split('; ') : [];

                // look for an existing cookie and remove it if it exists
                for (let i = 0; i < cookies.length; i++) {
                    const cookieBits = cookies[i].split('=');
                    if (cookieBits[0] === bits[0]) {
                        cookies.splice(i, 1);
                        break;
                    }
                }
                cookies.push(pair);
                this.value = cookies.join('; ');
                return this.value;
            },
        });
        cookies.forEach((cookie) => {
            document.cookie = `${cookie.name}=${cookie.value}`;
        });

        await this.startApp();
    }

    startApp = () => {
        this.setState({appReady: true});
    }

    render() {
        const {appReady} = this.state;
        if (!appReady) {
            return null;
        }
        return (
            <MattermostAppComponent/>
        );
    }
}

ReactDOM.render(
    <MattermostApp/>,
    document.getElementById('root'),
);
