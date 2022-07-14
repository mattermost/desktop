// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import {ModalMessage} from 'types/modals';

import {MODAL_CANCEL, MODAL_INFO, MODAL_RESULT, RETRIEVE_MODAL_INFO} from 'common/communication';

import IntlProvider from 'renderer/intl_provider';

import RemoveServerModal from '../../components/RemoveServerModal';

import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.postMessage({type: MODAL_CANCEL}, window.location.href);
};

const onSave = (data: boolean) => {
    window.postMessage({type: MODAL_RESULT, data}, window.location.href);
};

const RemoveServerModalWrapper: React.FC = () => {
    const [serverName, setServerName] = useState<string>('');

    const handleRemoveServerMessage = (event: {data: ModalMessage<string>}) => {
        switch (event.data.type) {
        case MODAL_INFO: {
            setServerName(event.data.data);
            break;
        }
        default:
            break;
        }
    };

    useEffect(() => {
        window.addEventListener('message', handleRemoveServerMessage);
        window.postMessage({type: RETRIEVE_MODAL_INFO}, window.location.href);
    }, []);

    return (
        <IntlProvider>
            <RemoveServerModal
                show={true}
                serverName={serverName}
                onHide={() => {
                    onClose();
                }}
                onCancel={() => {
                    onSave(false);
                }}
                onAccept={() => {
                    onSave(true);
                }}
            />
        </IntlProvider>
    );
};

const start = async () => {
    ReactDOM.render(
        <RemoveServerModalWrapper/>,
        document.getElementById('app'),
    );
};

start();
