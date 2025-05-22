// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import ServerSmallImage from 'renderer/components/Images/server-small';
import NewServerModal from 'renderer/components/NewServerModal';
import RemoveServerModal from 'renderer/components/RemoveServerModal';

import type {Server, UniqueServer} from 'types/config';
import type {Permissions, UniqueServerWithPermissions} from 'types/permissions';

import './ServerSetting.scss';

enum Modal {
    ADD = 1,
    EDIT,
    REMOVE,
}

export default function ServerSetting() {
    const [servers, setServers] = useState<UniqueServerWithPermissions[]>([]);
    const [currentServer, setCurrentServer] = useState<UniqueServerWithPermissions>();
    const [modal, setModal] = useState<Modal>();
    const [enableServerManagement, setEnableServerManagement] = useState<boolean>(false);

    const reloadServers = useCallback(() => {
        window.desktop.getUniqueServersWithPermissions().then(setServers);
    }, []);

    useEffect(() => {
        const off = window.desktop.onReloadConfiguration(reloadServers);
        reloadServers();

        window.desktop.getLocalConfiguration().then((config) => {
            setEnableServerManagement(config.enableServerManagement);
        });

        return () => off();
    }, []);

    const closeModal = () => {
        setCurrentServer(undefined);
        setModal(undefined);
    };

    const addServer = (server: Server) => {
        window.desktop.addServer(server);
        closeModal();
    };

    const editServer = (server: UniqueServer, permissions?: Permissions) => {
        window.desktop.editServer(server, permissions);
        closeModal();
    };

    const removeServer = () => {
        if (currentServer?.server.id) {
            window.desktop.removeServer(currentServer.server.id);
        }
        closeModal();
    };

    const showAddServerModal = () => {
        setModal(Modal.ADD);
    };

    const showEditServerModal = (server: UniqueServerWithPermissions) => () => {
        setCurrentServer(server);
        setModal(Modal.EDIT);
    };

    const showRemoveServerModal = (server: UniqueServerWithPermissions) => () => {
        setCurrentServer(server);
        setModal(Modal.REMOVE);
    };

    let openModal;
    switch (modal) {
    case Modal.ADD:
        openModal = (
            <NewServerModal
                onClose={closeModal}
                onSave={addServer}
                show={true}
            />
        );
        break;
    case Modal.EDIT:
        openModal = (
            <NewServerModal
                onClose={closeModal}
                onSave={editServer}
                editMode={true}
                show={true}
                server={currentServer?.server}
                permissions={currentServer?.permissions}
            />
        );
        break;
    case Modal.REMOVE:
        openModal = (
            <RemoveServerModal
                show={true}
                onHide={closeModal}
                onCancel={closeModal}
                onAccept={removeServer}
            />
        );
        break;
    }

    return (
        <>
            <div className='ServerSetting'>
                <div className='ServerSetting__heading'>
                    <h3>
                        <FormattedMessage
                            id='renderer.components.settingsPage.serverSetting.title'
                            defaultMessage='Servers'
                        />
                    </h3>
                    {enableServerManagement &&
                        <button
                            onClick={showAddServerModal}
                            className='ServerSetting__addServer btn btn-sm btn-tertiary'
                        >
                            <i className='icon icon-plus'/>
                            <FormattedMessage
                                id='renderer.components.settingsPage.serverSetting.addAServer'
                                defaultMessage='Add a server'
                            />
                        </button>
                    }
                </div>
                {servers.length === 0 && (
                    <div className='ServerSetting__noServers'>
                        <ServerSmallImage/>
                        <div className='ServerSetting__noServersTitle'>
                            <FormattedMessage
                                id='renderer.components.settingsPage.serverSetting.noServers'
                                defaultMessage='No servers added'
                            />
                        </div>
                        {enableServerManagement && <div className='ServerSetting__noServersDescription'>
                            <FormattedMessage
                                id='renderer.components.settingsPage.serverSetting.noServers.description'
                                defaultMessage="Add a server to connect to your team's communication hub"
                            />
                        </div>}
                    </div>
                )}
                <div className='ServerSetting__serverList'>
                    {(servers.map((server, index) => (
                        <div
                            key={`${index}`}
                            className='ServerSetting__server'
                        >
                            <i className='icon icon-server-variant'/>
                            <div className='ServerSetting__serverName'>
                                {server.server.name}
                            </div>
                            <div className='ServerSetting__serverUrl'>
                                {server.server.url}
                            </div>
                            <button
                                onClick={showEditServerModal(server)}
                                className='ServerSetting__editServer btn btn-icon btn-sm'
                            >
                                <i className='icon icon-pencil-outline'/>
                            </button>
                            {enableServerManagement && !server.server.isPredefined &&
                                <button
                                    onClick={showRemoveServerModal(server)}
                                    className='ServerSetting__removeServer btn btn-icon btn-sm btn-tertiary btn-transparent btn-danger'
                                >
                                    <i className='icon icon-trash-can-outline'/>
                                </button>
                            }
                        </div>
                    )))}
                </div>
                {openModal}
            </div>
        </>
    );
}
