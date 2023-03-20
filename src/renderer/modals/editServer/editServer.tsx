// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import {MattermostTeam} from 'types/config';

import IntlProvider from 'renderer/intl_provider';

import NewTeamModal from '../../components/NewTeamModal'; //'./addServer.jsx';

import setupDarkMode from '../darkMode';

setupDarkMode();

type ModalInfo = {
    team: MattermostTeam;
    currentTeams: MattermostTeam[];
};

const onClose = () => {
    window.desktop.modals.cancelModal();
};

const onSave = (data: MattermostTeam) => {
    window.desktop.modals.finishModal(data);
};

const EditServerModalWrapper: React.FC = () => {
    const [server, setServer] = useState<MattermostTeam>();
    const [currentTeams, setCurrentTeams] = useState<MattermostTeam[]>();

    useEffect(() => {
        window.desktop.modals.getModalInfo<ModalInfo>().then(({team, currentTeams}) => {
            setServer(team);
            setCurrentTeams(currentTeams);
        });
    }, []);

    return (
        <IntlProvider>
            <NewTeamModal
                onClose={onClose}
                onSave={onSave}
                editMode={true}
                show={Boolean(server)}
                team={server}
                currentTeams={currentTeams}
            />
        </IntlProvider>
    );
};

const start = async () => {
    ReactDOM.render(
        <EditServerModalWrapper/>,
        document.getElementById('app'),
    );
};

start();
