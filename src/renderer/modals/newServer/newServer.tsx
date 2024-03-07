// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import type {UniqueServer} from 'types/config';

import NewServerModal from '../../components/NewServerModal';
import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.desktop.modals.cancelModal();
};

const onSave = (data: UniqueServer) => {
    window.desktop.modals.finishModal(data);
};

const NewServerModalWrapper: React.FC = () => {
    const [unremoveable, setUnremovable] = useState<boolean>();

    useEffect(() => {
        window.desktop.modals.isModalUncloseable().then((uncloseable) => {
            setUnremovable(uncloseable);
        });
    }, []);

    return (
        <IntlProvider>
            <NewServerModal
                onClose={unremoveable ? undefined : onClose}
                onSave={onSave}
                editMode={false}
                show={true}
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
