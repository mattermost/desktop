// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/index.css';

import React from 'react';
import ReactDOM from 'react-dom';

import {GET_CONFIGURATION, UPDATE_TEAMS, QUIT, RELOAD_CONFIGURATION} from 'common/communication';

import MainPage from './components/MainPage.jsx';
class Root extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {};
    }

    async componentDidMount() {
        await this.setInitialConfig();

        window.ipcRenderer.on('synchronize-config', () => {
            this.reloadConfig();
        });

        window.ipcRenderer.on(RELOAD_CONFIGURATION, () => {
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

    moveTabs = async (originalOrder, newOrder) => {
        const teams = this.state.config.teams.concat();
        const tabOrder = teams.map((team, index) => {
            return {
                index,
                order: team.order,
            };
        }).sort((a, b) => (a.order - b.order));

        const team = tabOrder.splice(originalOrder, 1);
        tabOrder.splice(newOrder, 0, team[0]);

        let teamIndex;
        tabOrder.forEach((t, order) => {
            if (order === newOrder) {
                teamIndex = t.index;
            }
            teams[t.index].order = order;
        });
        await this.teamConfigChange(teams);
        return teamIndex;
    };

    teamConfigChange = async (updatedTeams, callback) => {
        const updatedConfig = await window.ipcRenderer.invoke(UPDATE_TEAMS, updatedTeams);
        await this.reloadConfig();
        if (callback) {
            callback(updatedConfig);
        }
    };

    reloadConfig = async () => {
        const config = await this.requestConfig();
        this.setState({config});
    };

    requestConfig = async (exitOnError) => {
        // todo: should we block?
        try {
            const configRequest = await window.ipcRenderer.invoke(GET_CONFIGURATION);
            return configRequest;
        } catch (err) {
            console.log(`there was an error with the config: ${err}`);
            if (exitOnError) {
                window.ipcRenderer.send(QUIT, `unable to load configuration: ${err}`, err.stack);
            }
        }
        return null;
    };

    openMenu = () => {
        if (window.process.platform !== 'darwin') {
            window.ipcRenderer.send('open-app-menu');
        }
    }

    render() {
        const {config} = this.state;
        if (!config) {
            return null;
        }

        return (
            <MainPage
                teams={config.teams}
                showAddServerButton={config.enableServerManagement}
                moveTabs={this.moveTabs}
                openMenu={this.openMenu}
                darkMode={config.darkMode}
                appName={config.appName}
            />
        );
    }
}
window.ipcRenderer.invoke('get-app-version').then(({name, version}) => {
    // eslint-disable-next-line no-undef
    console.log(`Starting ${name} v${version} commit: ${__HASH_VERSION__}`);
});

ReactDOM.render(
    <Root/>,
    document.getElementById('app'),
);
