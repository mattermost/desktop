// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import {TeamWithIndex} from 'types/config';
import {ModalMessage} from 'types/modals';

import {MODAL_CANCEL, MODAL_INFO, MODAL_RESULT, RETRIEVE_MODAL_INFO} from 'common/communication';

import IntlProvider from 'renderer/intl_provider';

import NewTeamModal from '../../components/NewTeamModal'; //'./addServer.jsx';

import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.postMessage({type: MODAL_CANCEL}, window.location.href);
};

const onSave = (data: TeamWithIndex) => {
    window.postMessage({type: MODAL_RESULT, data}, window.location.href);
};

const EditServerModalWrapper: React.FC = () => {
    const [server, setServer] = useState<TeamWithIndex>();
    const [currentTeams, setCurrentTeams] = useState<TeamWithIndex[]>();

    const handleEditServerMessage = (event: {data: ModalMessage<{currentTeams: TeamWithIndex[]; team: TeamWithIndex}>}) => {
        switch (event.data.type) {
        case MODAL_INFO: {
            setServer(event.data.data.team);
            setCurrentTeams(event.data.data.currentTeams);
            break;
        }
        default:
            break;
        }
    };

    useEffect(() => {
        window.addEventListener('message', handleEditServerMessage);
        window.postMessage({type: RETRIEVE_MODAL_INFO}, window.location.href);
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
