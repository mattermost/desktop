// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'renderer/css/index.scss';

import React from 'react';
import ReactDOM from 'react-dom';

import {createHashHistory, History} from 'history';

import {CombinedConfig, Team} from 'types/config';

import {getAPI, setAPI} from './api';
import MainPage from './components/MainPage';
import IntlProvider from './intl_provider';

type State = {
    config?: CombinedConfig;
}

import('mattermost_webapp/styles');

const LazyApp = React.lazy(() => import('mattermost_webapp/app'));
const MattermostAppComponent = (props: any) => (
    <React.Suspense fallback={<div>{'Loading...'}</div>}>
        <LazyApp {...props}/>
    </React.Suspense>
);
MattermostAppComponent.displayName = 'App';

class Root extends React.PureComponent<Record<string, never>, State> {
    registry?: {
        getModule: <T>(name: string) => T;
        setModule: <T>(name: string, component: T) => boolean;
    }

    constructor(props: Record<string, never>) {
        super(props);
        this.state = {};
    }

    async componentDidMount() {
        await setAPI();

        getAPI().getVersion().then(({name, version}) => {
            // eslint-disable-next-line no-undef
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            console.log(`Starting ${name} v${version}${__HASH_VERSION__ ? ` commit: ${__HASH_VERSION__}` : ''}`);
        });

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

        await this.setInitialConfig();

        getAPI().onSynchronizeConfig(() => {
            this.reloadConfig();
        });

        getAPI().onReloadConfiguration(() => {
            this.reloadConfig();
        });

        // Deny drag&drop navigation in mainWindow.
        // Drag&drop is allowed in webview of index.html.
        document.addEventListener('dragover', (event) => event.preventDefault());
        document.addEventListener('drop', (event) => event.preventDefault());
    }

    setInitialConfig = async () => {
        const config = await this.requestConfig(true);
        this.setState({config});
    }

    moveTabs = (teamName: string, originalOrder: number, newOrder: number): number | undefined => {
        if (!this.state.config) {
            throw new Error('No config');
        }
        const teams = this.state.config.teams.concat();
        const currentTeamIndex = teams.findIndex((team) => team.name === teamName);
        const tabs = teams[currentTeamIndex].tabs.concat();

        const tabOrder = tabs.map((team, index) => {
            return {
                index,
                order: team.order,
            };
        }).sort((a, b) => (a.order - b.order));

        const team = tabOrder.splice(originalOrder, 1);
        tabOrder.splice(newOrder, 0, team[0]);

        let teamIndex: number | undefined;
        tabOrder.forEach((t, order) => {
            if (order === newOrder) {
                teamIndex = t.index;
            }
            tabs[t.index].order = order;
        });
        teams[currentTeamIndex].tabs = tabs;
        this.setState({
            config: {
                ...this.state.config,
                teams,
            },
        });
        this.teamConfigChange(teams);
        return teamIndex;
    };

    teamConfigChange = async (updatedTeams: Team[]) => {
        getAPI().updateTeams(updatedTeams).then(() => {
            this.reloadConfig();
        });
    };

    reloadConfig = async () => {
        const config = await this.requestConfig();
        this.setState({config});
    };

    requestConfig = async (exitOnError?: boolean) => {
        // todo: should we block?
        try {
            const configRequest = await getAPI().getConfiguration() as CombinedConfig;
            return configRequest;
        } catch (err: any) {
            console.log(`there was an error with the config: ${err}`);
            if (exitOnError) {
                getAPI().quit(`unable to load configuration: ${err}`, err.stack);
            }
        }
        return undefined;
    };

    openMenu = () => {
        if (window.process.platform !== 'darwin') {
            getAPI().openAppMenu();
        }
    }

    render() {
        const {config} = this.state;
        if (!config) {
            return null;
        }

        return (
            <>
                <div id='main'>
                    <IntlProvider>
                        <MainPage
                            teams={config.teams}
                            lastActiveTeam={config.lastActiveTeam}
                            moveTabs={this.moveTabs}
                            openMenu={this.openMenu}
                            darkMode={config.darkMode}
                            appName={config.appName}
                            useNativeWindow={config.useNativeWindow}
                        />
                    </IntlProvider>
                </div>
                <div id='root'>
                    <MattermostAppComponent/>
                </div>
            </>
        );
    }
}

ReactDOM.render(
    <Root/>,
    document.getElementById('app'),
);
