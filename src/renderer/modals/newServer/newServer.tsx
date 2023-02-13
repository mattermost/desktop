// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import {TeamWithIndex} from 'types/config';

import IntlProvider from 'renderer/intl_provider';

import NewTeamModal from '../../components/NewTeamModal'; //'./addServer.jsx';

import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.desktop.modals.cancelModal();
};

const onSave = (data: TeamWithIndex) => {
    window.desktop.modals.finishModal(data);
};

const NewServerModalWrapper: React.FC = () => {
    const [unremoveable, setUnremovable] = useState<boolean>();
    const [currentTeams, setCurrentTeams] = useState<TeamWithIndex[]>();

    useEffect(() => {
        window.desktop.modals.isModalUncloseable().then((uncloseable) => {
            setUnremovable(uncloseable);
        });
        window.desktop.modals.getModalInfo<TeamWithIndex[]>().then((teams) => {
            setCurrentTeams(teams);
        });
    }, []);

    return (
        <IntlProvider>
            <NewTeamModal
                onClose={unremoveable ? undefined : onClose}
                onSave={onSave}
                editMode={false}
                show={true}
                currentTeams={currentTeams}
            />
        </IntlProvider>
    );
};

const start = async () => {
    ReactDOM.render(
        <NewServerModalWrapper/>,
        document.getElementById('app'),
    );
};

start();
