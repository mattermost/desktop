// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import RemoveServerModal from '../../components/RemoveServerModal';
import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.desktop.modals.cancelModal();
};

const onSave = (data: boolean) => {
    window.desktop.modals.finishModal(data);
};

const RemoveServerModalWrapper: React.FC = () => {
    const [serverName, setServerName] = useState<string>('');

    useEffect(() => {
        window.desktop.modals.getModalInfo<{name: string}>().then(({name}) => {
            setServerName(name);
        });
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
