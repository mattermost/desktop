// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import type {UniqueServer} from 'types/config';
import type {Permissions} from 'types/permissions';

import NewServerModal from '../../components/NewServerModal';
import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.desktop.modals.cancelModal();
};

const onSave = (server: UniqueServer, permissions?: Permissions) => {
    window.desktop.modals.finishModal({server, permissions});
};

const EditServerModalWrapper: React.FC = () => {
    const [data, setData] = useState<{server: UniqueServer; permissions: Permissions}>();

    useEffect(() => {
        window.desktop.modals.getModalInfo<{server: UniqueServer; permissions: Permissions}>().
            then((data) => {
                setData(data);
            });
    }, []);

    return (
        <IntlProvider>
            <NewServerModal
                onClose={onClose}
                onSave={onSave}
                editMode={true}
                show={Boolean(data?.server)}
                server={data?.server}
                permissions={data?.permissions}
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
