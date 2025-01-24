// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'renderer/css/index.css';

import React from 'react';
import ReactDOM from 'react-dom';

import type {CombinedConfig} from 'types/config';

import MainPage from './components/MainPage';
import IntlProvider from './intl_provider';

type State = {
    config?: CombinedConfig;
}

class Root extends React.PureComponent<Record<string, never>, State> {
    constructor(props: Record<string, never>) {
        super(props);
        this.state = {};
    }

    async componentDidMount() {
        await this.setInitialConfig();

        window.desktop.onSynchronizeConfig(() => {
            this.reloadConfig();
        });

        window.desktop.onReloadConfiguration(() => {
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
    };

    reloadConfig = async () => {
        const config = await this.requestConfig();
        this.setState({config});
    };

    requestConfig = async (exitOnError?: boolean) => {
        // todo: should we block?
        try {
            const configRequest = await window.desktop.getConfiguration() as CombinedConfig;
            return configRequest;
        } catch (err: any) {
            console.error(`there was an error with the config: ${err}`);
            if (exitOnError) {
                window.desktop.quit(`unable to load configuration: ${err}`, err.stack);
            }
        }
        return undefined;
    };

    openMenu = () => {
        if (window.process.platform !== 'darwin') {
            window.desktop.openAppMenu();
        }
    };

    render() {
        const {config} = this.state;
        if (!config) {
            return null;
        }
        return (
            <IntlProvider>
                <MainPage
                    openMenu={this.openMenu}
                    darkMode={config.darkMode}
                    appName={config.appName}
                />
            </IntlProvider>
        );
    }
}
window.desktop.getVersion().then(({name, version}) => {
    // eslint-disable-next-line no-undef
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    console.log(`Starting ${name} v${version}${__HASH_VERSION__ ? ` commit: ${__HASH_VERSION__}` : ''}`);
});

ReactDOM.render(
    <Root/>,
    document.getElementById('app'),
);
