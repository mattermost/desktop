// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import {TeamWithIndex} from 'types/config';
import {ModalMessage} from 'types/modals';

import {GET_MODAL_UNCLOSEABLE, MODAL_CANCEL, MODAL_RESULT, MODAL_UNCLOSEABLE} from 'common/communication';

import NewTeamModal from '../../components/NewTeamModal'; //'./addServer.jsx';

import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.postMessage({type: MODAL_CANCEL}, window.location.href);
};

const onSave = (data: TeamWithIndex) => {
    window.postMessage({type: MODAL_RESULT, data}, window.location.href);
};

const NewServerModalWrapper: React.FC = () => {
    const [unremoveable, setUnremovable] = useState<boolean>();

    const handleNewServerMessage = (event: {data: ModalMessage<boolean>}) => {
        switch (event.data.type) {
        case MODAL_UNCLOSEABLE: {
            setUnremovable(event.data.data);
            break;
        }
        default:
            break;
        }
    };

    useEffect(() => {
        window.addEventListener('message', handleNewServerMessage);
        window.postMessage({type: GET_MODAL_UNCLOSEABLE}, window.location.href);

        return () => {
            window.removeEventListener('message', handleNewServerMessage);
        };
    }, []);

    return (
        <NewTeamModal
            onClose={unremoveable ? undefined : onClose}
            onSave={onSave}
            editMode={false}
            show={true}
        />
    );
};

const start = async () => {
    ReactDOM.render(
        <NewServerModalWrapper/>,
        document.getElementById('app'),
    );
};

start();
