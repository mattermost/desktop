// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
    const [data, setData] = useState<{prefillURL?: string}>();
    const [unremoveable, setUnremovable] = useState<boolean>();

    useEffect(() => {
        window.desktop.modals.isModalUncloseable().then((uncloseable) => {
            setUnremovable(uncloseable);
        });

        window.desktop.modals.getModalInfo<{prefillURL?: string}>().
            then((data) => {
                setData(data);
            });
    }, []);

    return (
        <IntlProvider>
            <NewServerModal
                unremoveable={unremoveable}
                onClose={onClose}
                onSave={onSave}
                editMode={false}
                prefillURL={data?.prefillURL}
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
