// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';
import {FormattedMessage, injectIntl} from 'react-intl';

import {URLValidationStatus} from 'common/utils/constants';
import Toggle from 'renderer/components/Toggle';

import type {UniqueServer} from 'types/config';
import type {Permissions} from 'types/permissions';
import type {URLValidationResult} from 'types/server';

import Input, {SIZE, STATUS} from './Input';
import {Modal} from './Modal';

import 'renderer/css/components/NewServerModal.scss';

type Props = {
    onClose: () => void;
    onSave?: (server: UniqueServer, permissions?: Permissions) => void;
    server?: UniqueServer;
    permissions?: Permissions;
    editMode?: boolean;
    show?: boolean;
    currentOrder?: number;
    intl: IntlShape;
    prefillURL?: string;
    unremoveable?: boolean;
};

type State = {
    serverName: string;
    serverUrl: string;
    serverId?: string;
    serverOrder: number;
    saveStarted: boolean;
    validationStarted: boolean;
    validationResult?: URLValidationResult;
    permissions: Permissions;
    cameraDisabled: boolean;
    microphoneDisabled: boolean;
}

class NewServerModal extends React.PureComponent<Props, State> {
    wasShown?: boolean;
    serverUrlInputRef?: HTMLInputElement;
    validationTimeout?: NodeJS.Timeout;
    mounted: boolean;

    constructor(props: Props) {
        super(props);

        this.wasShown = false;
        this.mounted = false;
        this.state = {
            serverName: '',
            serverUrl: '',
            serverOrder: props.currentOrder || 0,
            saveStarted: false,
            validationStarted: false,
            permissions: {},
            cameraDisabled: false,
            microphoneDisabled: false,
        };
    }

    componentDidMount(): void {
        this.mounted = true;
    }

    componentWillUnmount(): void {
        this.mounted = false;
    }

    componentDidUpdate(prevProps: Readonly<Props>): void {
        if (this.props.prefillURL && this.props.prefillURL !== prevProps.prefillURL) {
            this.setState({serverUrl: this.props.prefillURL});
            this.validateServerURL(this.props.prefillURL);
        }
    }

    initializeOnShow = async () => {
        const cameraDisabled = window.process.platform === 'win32' && await window.desktop.getMediaAccessStatus('camera') !== 'granted';
        const microphoneDisabled = window.process.platform === 'win32' && await window.desktop.getMediaAccessStatus('microphone') !== 'granted';

        this.setState({
            serverName: this.props.server ? this.props.server.name : '',
            serverUrl: this.props.server ? this.props.server.url : '',
            serverId: this.props.server?.id,
            saveStarted: false,
            validationStarted: false,
            validationResult: undefined,
            permissions: this.props.permissions ?? {},
            cameraDisabled,
            microphoneDisabled,
        });

        if (this.props.editMode && this.props.server) {
            this.validateServerURL(this.props.server.url);
        }
    };

    handleServerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            serverName: e.target.value,
        });
    };

    handleServerUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const serverUrl = e.target.value;
        this.setState({serverUrl, validationResult: undefined});
        this.validateServerURL(serverUrl);
    };

    handleChangePermission = (permissionKey: string) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => {
            this.setState({
                permissions: {
                    ...this.state.permissions,
                    [permissionKey]: {
                        allowed: e.target.checked,
                        alwaysDeny: e.target.checked ? undefined : true,
                    },
                },
            });
        };
    };

    validateServerURL = (serverUrl: string) => {
        clearTimeout(this.validationTimeout as unknown as number);
        this.validationTimeout = setTimeout(() => {
            if (!this.mounted) {
                return;
            }
            const currentTimeout = this.validationTimeout;
            this.setState({validationStarted: true});
            window.desktop.validateServerURL(serverUrl, this.props.server?.id).then((validationResult) => {
                if (!this.mounted) {
                    return;
                }
                if (currentTimeout !== this.validationTimeout) {
                    return;
                }
                this.setState({validationResult, validationStarted: false, serverUrl: validationResult.validatedURL ?? serverUrl, serverName: this.state.serverName ? this.state.serverName : validationResult.serverName ?? ''});
            });
        }, 1000);
    };

    isServerURLErrored = () => {
        return this.state.validationResult?.status === URLValidationStatus.Invalid ||
            this.state.validationResult?.status === URLValidationStatus.Missing;
    };

    getServerURLMessage = () => {
        if (this.state.validationStarted) {
            return {
                type: STATUS.INFO,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.validating',
                    defaultMessage: 'Validating...',
                }),
            };
        }

        if (!this.state.validationResult) {
            return null;
        }

        switch (this.state.validationResult?.status) {
        case URLValidationStatus.Missing:
            return {
                type: STATUS.ERROR,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.error.urlRequired',
                    defaultMessage: 'URL is required.',
                }),
            };
        case URLValidationStatus.Invalid:
            return {
                type: STATUS.ERROR,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.error.urlIncorrectFormatting',
                    defaultMessage: 'URL is not formatted correctly.',
                }),
            };
        case URLValidationStatus.URLExists:
            return {
                type: STATUS.WARNING,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.error.serverUrlExists',
                    defaultMessage: 'A server named {serverName} with the same Site URL already exists.',
                }, {
                    serverName: this.state.validationResult.existingServerName,
                }),
            };
        case URLValidationStatus.Insecure:
            return {
                type: STATUS.WARNING,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.warning.insecure',
                    defaultMessage: 'Your server URL is potentially insecure. For best results, use a URL with the HTTPS protocol.',
                }),
            };
        case URLValidationStatus.NotMattermost:
            return {
                type: STATUS.WARNING,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.warning.notMattermost',
                    defaultMessage: 'The server URL provided does not appear to point to a valid Mattermost server. Please verify the URL and check your connection.',
                }),
            };
        case URLValidationStatus.URLNotMatched:
            return {
                type: STATUS.WARNING,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.warning.urlNotMatched',
                    defaultMessage: 'The server URL does not match the configured Site URL on your Mattermost server. Server version: {serverVersion}',
                }, {
                    serverVersion: this.state.validationResult.serverVersion,
                }),
            };
        case URLValidationStatus.URLUpdated:
            return {
                type: STATUS.INFO,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.warning.urlUpdated',
                    defaultMessage: 'The server URL provided has been updated to match the configured Site URL on your Mattermost server. Server version: {serverVersion}',
                }, {
                    serverVersion: this.state.validationResult.serverVersion,
                }),
            };
        }

        return {
            type: STATUS.SUCCESS,
            value: this.props.intl.formatMessage({
                id: 'renderer.components.newServerModal.success.ok',
                defaultMessage: 'Server URL is valid. Server version: {serverVersion}',
            }, {
                serverVersion: this.state.validationResult.serverVersion,
            }),
        };
    };

    openNotificationPrefs = () => {
        window.desktop.openNotificationPreferences();
    };

    openWindowsCameraPrefs = () => {
        window.desktop.openWindowsCameraPreferences();
    };

    openWindowsMicrophonePrefs = () => {
        window.desktop.openWindowsMicrophonePreferences();
    };

    getServerNameMessage = () => {
        if (!this.state.validationResult) {
            return null;
        }

        if (!this.state.serverName.length) {
            return {
                type: STATUS.ERROR,
                value: this.props.intl.formatMessage({
                    id: 'renderer.components.newServerModal.error.nameRequired',
                    defaultMessage: 'Name is required.',
                }),
            };
        }
        return null;
    };

    save = () => {
        if (this.props.editMode && this.props.server?.isPredefined) {
            this.setState({
                saveStarted: true,
            }, () => {
                this.props.onSave?.(this.props.server!, this.state.permissions);
            });
        } else {
            if (!this.state.validationResult) {
                return;
            }

            if (this.isServerURLErrored()) {
                return;
            }

            this.setState({
                saveStarted: true,
            }, () => {
                this.props.onSave?.({
                    url: this.state.serverUrl,
                    name: this.state.serverName,
                    id: this.state.serverId,
                }, this.state.permissions);
            });
        }
    };

    getSaveButtonLabel() {
        if (this.props.editMode) {
            return (
                <FormattedMessage
                    id='label.save'
                    defaultMessage='Save'
                />
            );
        }
        return (
            <FormattedMessage
                id='label.add'
                defaultMessage='Add'
            />
        );
    }

    getModalTitle() {
        if (this.props.editMode) {
            return (
                <FormattedMessage
                    id='renderer.components.newServerModal.title.edit'
                    defaultMessage='Edit Server'
                />
            );
        }
        return (
            <FormattedMessage
                id='renderer.components.newServerModal.title.add'
                defaultMessage='Add Server'
            />
        );
    }

    render() {
        if (this.wasShown !== this.props.show && this.props.show) {
            this.initializeOnShow();
        }
        this.wasShown = this.props.show;

        const notificationValues = {
            link: (msg: React.ReactNode) => (
                <a
                    href='#'
                    onClick={this.openNotificationPrefs}
                >
                    {msg}
                </a>
            ),
        };

        return (
            <Modal
                show={this.props.show}
                id='newServerModal'
                className='NewServerModal'
                onExited={this.props.unremoveable ? () => {} : this.props.onClose}
                modalHeaderText={this.getModalTitle()}
                confirmButtonText={this.getSaveButtonLabel()}
                handleEnterKeyPress={this.save}
                handleConfirm={this.save}
                isConfirmDisabled={!this.state.serverName.length || !this.state.validationResult || this.isServerURLErrored()}
                handleCancel={this.props.onClose}
                bodyDivider={true}
                footerDivider={true}
            >
                <>
                    {!(this.props.editMode && this.props.server?.isPredefined) &&
                        <>
                            <Input
                                autoFocus={true}
                                id='serverUrlInput'
                                name='url'
                                type='text'
                                inputSize={SIZE.LARGE}
                                value={this.state.serverUrl}
                                onChange={this.handleServerUrlChange}
                                customMessage={this.getServerURLMessage() ?? ({
                                    type: STATUS.INFO,
                                    value: this.props.intl.formatMessage({
                                        id: 'renderer.components.newServerModal.serverURL.description',
                                        defaultMessage: 'The URL of your Mattermost server. Must start with http:// or https://.',
                                    }),
                                })}
                                placeholder={this.props.intl.formatMessage({
                                    id: 'renderer.components.newServerModal.serverURL',
                                    defaultMessage: 'Server URL',
                                })}
                            />
                            <Input
                                id='serverNameInput'
                                name='name'
                                type='text'
                                inputSize={SIZE.LARGE}
                                value={this.state.serverName}
                                onChange={this.handleServerNameChange}
                                customMessage={this.getServerNameMessage() ?? ({
                                    type: STATUS.INFO,
                                    value: this.props.intl.formatMessage({
                                        id: 'renderer.components.newServerModal.serverDisplayName.description',
                                        defaultMessage: 'The name of the server displayed on your desktop app tab bar.',
                                    }),
                                })}
                                placeholder={this.props.intl.formatMessage({
                                    id: 'renderer.components.newServerModal.serverDisplayName',
                                    defaultMessage: 'Server display name',
                                })}
                            />
                        </>
                    }
                    {this.props.editMode &&
                        <>
                            <hr/>
                            <h3 className='NewServerModal__permissions__title'>
                                <FormattedMessage
                                    id='renderer.components.newServerModal.permissions.title'
                                    defaultMessage='Permissions'
                                />
                            </h3>
                            <Toggle
                                isChecked={this.state.permissions.media?.allowed}
                                onChange={this.handleChangePermission('media')}
                            >
                                <i className='icon icon-microphone'/>
                                <div>
                                    <FormattedMessage
                                        id='renderer.components.newServerModal.permissions.microphoneAndCamera'
                                        defaultMessage='Microphone and Camera'
                                    />
                                    {this.state.cameraDisabled &&
                                        <small className='NewServerModal__toggle__description'>
                                            <FormattedMessage
                                                id='renderer.components.newServerModal.permissions.microphoneAndCamera.windowsCameraPermissions'
                                                defaultMessage='Camera is disabled in Windows Settings. Click <link>here</link> to open the Camera Settings.'
                                                values={{
                                                    link: (msg: React.ReactNode) => (
                                                        <a
                                                            href='#'
                                                            onClick={this.openWindowsCameraPrefs}
                                                        >
                                                            {msg}
                                                        </a>
                                                    ),
                                                }}
                                            />
                                        </small>
                                    }
                                    {this.state.microphoneDisabled &&
                                        <small className='NewServerModal__toggle__description'>
                                            <FormattedMessage
                                                id='renderer.components.newServerModal.permissions.microphoneAndCamera.windowsMicrophoneaPermissions'
                                                defaultMessage='Microphone is disabled in Windows Settings. Click <link>here</link> to open the Microphone Settings.'
                                                values={{
                                                    link: (msg: React.ReactNode) => (
                                                        <a
                                                            href='#'
                                                            onClick={this.openWindowsMicrophonePrefs}
                                                        >
                                                            {msg}
                                                        </a>
                                                    ),
                                                }}
                                            />
                                        </small>
                                    }
                                </div>
                            </Toggle>
                            <Toggle
                                isChecked={this.state.permissions.notifications?.allowed}
                                onChange={this.handleChangePermission('notifications')}
                            >
                                <i className='icon icon-bell-outline'/>
                                <div>
                                    <FormattedMessage
                                        id='renderer.components.newServerModal.permissions.notifications'
                                        defaultMessage='Notifications'
                                    />
                                    {window.process.platform === 'darwin' &&
                                        <small className='NewServerModal__toggle__description'>
                                            <FormattedMessage
                                                id='renderer.components.newServerModal.permissions.notifications.mac'
                                                defaultMessage='You may also need to enable notifications in macOS for Mattermost. Click <link>here</link> to open the System Preferences.'
                                                values={notificationValues}
                                            />
                                        </small>
                                    }
                                    {window.process.platform === 'win32' &&
                                        <small className='NewServerModal__toggle__description'>
                                            <FormattedMessage
                                                id='renderer.components.newServerModal.permissions.notifications.windows'
                                                defaultMessage='You may also need to enable notifications in Windows for Mattermost. Click <link>here</link> to open the Notification Settings.'
                                                values={notificationValues}
                                            />
                                        </small>
                                    }
                                </div>
                            </Toggle>
                            <Toggle
                                isChecked={this.state.permissions.geolocation?.allowed}
                                onChange={this.handleChangePermission('geolocation')}
                            >
                                <i className='icon icon-map-marker-outline'/>
                                <FormattedMessage
                                    id='renderer.components.newServerModal.permissions.geolocation'
                                    defaultMessage='Location'
                                />
                            </Toggle>
                            <Toggle
                                isChecked={this.state.permissions.screenShare?.allowed}
                                onChange={this.handleChangePermission('screenShare')}
                            >
                                <i className='icon icon-monitor-share'/>
                                <FormattedMessage
                                    id='renderer.components.newServerModal.permissions.screenShare'
                                    defaultMessage='Screen Share'
                                />
                            </Toggle>
                        </>
                    }
                </>
            </Modal>
        );
    }
}

export default injectIntl(NewServerModal);
