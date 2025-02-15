// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import type {Server} from 'types/config';
import type {Permissions, UniqueServerWithPermissions} from 'types/permissions';

import NewServerModal from '../../components/NewServerModal';
import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.desktop.modals.cancelModal();
};

const onSave = (server: Server, permissions?: Permissions) => {
    window.desktop.modals.finishModal({server, permissions});
};

const EditServerModalWrapper: React.FC = () => {
    const [data, setData] = useState<UniqueServerWithPermissions>();

    useEffect(() => {
        window.desktop.modals.getModalInfo<UniqueServerWithPermissions>().
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
