// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal, Button, FormGroup, FormControl, FormLabel, FormText} from 'react-bootstrap';
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl';

import {UniqueServer} from 'types/config';

import {isValidURL} from 'common/utils/url';

type Props = {
    onClose?: () => void;
    onSave?: (server: UniqueServer) => void;
    server?: UniqueServer;
    currentServers?: UniqueServer[];
    editMode?: boolean;
    show?: boolean;
    restoreFocus?: boolean;
    currentOrder?: number;
    setInputRef?: (inputRef: HTMLInputElement) => void;
    intl: IntlShape;
};

type State = {
    serverName: string;
    serverUrl: string;
    serverId?: string;
    serverOrder: number;
    saveStarted: boolean;
}

class NewServerModal extends React.PureComponent<Props, State> {
    wasShown?: boolean;
    serverUrlInputRef?: HTMLInputElement;

    static defaultProps = {
        restoreFocus: true,
    };

    constructor(props: Props) {
        super(props);

        this.wasShown = false;
        this.state = {
            serverName: '',
            serverUrl: '',
            serverOrder: props.currentOrder || 0,
            saveStarted: false,
        };
    }

    initializeOnShow() {
        this.setState({
            serverName: this.props.server ? this.props.server.name : '',
            serverUrl: this.props.server ? this.props.server.url : '',
            serverId: this.props.server?.id,
            saveStarted: false,
        });
    }

    getServerNameValidationError() {
        if (!this.state.saveStarted) {
            return null;
        }
        if (this.props.currentServers) {
            const currentServers = [...this.props.currentServers];
            if (currentServers.find((server) => server.id !== this.state.serverId && server.name === this.state.serverName)) {
                return (
                    <FormattedMessage
                        id='renderer.components.newServerModal.error.serverNameExists'
                        defaultMessage='A server with the same name already exists.'
                    />
                );
            }
        }
        return this.state.serverName.length > 0 ? null : (
            <FormattedMessage
                id='renderer.components.newServerModal.error.nameRequired'
                defaultMessage='Name is required.'
            />
        );
    }

    getServerNameValidationState() {
        return this.getServerNameValidationError() === null ? null : 'error';
    }

    handleServerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            serverName: e.target.value,
        });
    }

    getServerUrlValidationError() {
        if (!this.state.saveStarted) {
            return null;
        }
        if (this.props.currentServers) {
            const currentServers = [...this.props.currentServers];
            if (currentServers.find((server) => server.id !== this.state.serverId && server.url === this.state.serverUrl)) {
                return (
                    <FormattedMessage
                        id='renderer.components.newServerModal.error.serverUrlExists'
                        defaultMessage='A server with the same URL already exists.'
                    />
                );
            }
        }
        if (this.state.serverUrl.length === 0) {
            return (
                <FormattedMessage
                    id='renderer.components.newServerModal.error.urlRequired'
                    defaultMessage='URL is required.'
                />
            );
        }
        if (!(/^https?:\/\/.*/).test(this.state.serverUrl.trim())) {
            return (
                <FormattedMessage
                    id='renderer.components.newServerModal.error.urlNeedsHttp'
                    defaultMessage='URL should start with http:// or https://.'
                />
            );
        }
        if (!isValidURL(this.state.serverUrl.trim())) {
            return (
                <FormattedMessage
                    id='renderer.components.newServerModal.error.urlIncorrectFormatting'
                    defaultMessage='URL is not formatted correctly.'
                />
            );
        }
        return null;
    }

    getServerUrlValidationState() {
        return this.getServerUrlValidationError() === null ? null : 'error';
    }

    handleServerUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const serverUrl = e.target.value;
        this.setState({serverUrl});
    }

    addProtocolToUrl = (serverUrl: string): Promise<void> => {
        if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
            return Promise.resolve(undefined);
        }

        return window.desktop.modals.pingDomain(serverUrl).
            then((result: string) => {
                this.setState({serverUrl: `${result}://${this.state.serverUrl}`});
            }).
            catch(() => {
                console.error(`Could not ping url: ${serverUrl}`);
            });
    }

    getError() {
        const nameError = this.getServerNameValidationError();
        const urlError = this.getServerUrlValidationError();

        if (nameError && urlError) {
            return (
                <>
                    {nameError}
                    <br/>
                    {urlError}
                </>
            );
        } else if (nameError) {
            return nameError;
        } else if (urlError) {
            return urlError;
        }
        return null;
    }

    validateForm() {
        return this.getServerNameValidationState() === null &&
            this.getServerUrlValidationState() === null;
    }

    save = async () => {
        await this.addProtocolToUrl(this.state.serverUrl);
        this.setState({
            saveStarted: true,
        }, () => {
            if (this.validateForm()) {
                this.props.onSave?.({
                    url: this.state.serverUrl,
                    name: this.state.serverName,
                    id: this.state.serverId,
                });
            }
        });
    }

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

        return (
            <Modal
                bsClass='modal'
                className='NewServerModal'
                show={this.props.show}
                id='newServerModal'
                enforceFocus={true}
                onEntered={() => this.serverUrlInputRef?.focus()}
                onHide={this.props.onClose}
                restoreFocus={this.props.restoreFocus}
                onKeyDown={(e: React.KeyboardEvent) => {
                    switch (e.key) {
                    case 'Enter':
                        this.save();

                        // The add button from behind this might still be focused
                        e.preventDefault();
                        e.stopPropagation();
                        break;
                    case 'Escape':
                        this.props.onClose?.();
                        break;
                    }
                }}
            >
                <Modal.Header>
                    <Modal.Title>{this.getModalTitle()}</Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    <form>
                        <FormGroup>
                            <FormLabel>
                                <FormattedMessage
                                    id='renderer.components.newServerModal.serverURL'
                                    defaultMessage='Server URL'
                                />
                            </FormLabel>
                            <FormControl
                                id='serverUrlInput'
                                type='text'
                                value={this.state.serverUrl}
                                placeholder='https://example.com'
                                onChange={this.handleServerUrlChange}
                                onClick={(e: React.MouseEvent<HTMLInputElement>) => {
                                    e.stopPropagation();
                                }}
                                ref={(ref: HTMLInputElement) => {
                                    this.serverUrlInputRef = ref;
                                    if (this.props.setInputRef) {
                                        this.props.setInputRef(ref);
                                    }
                                }}
                                isInvalid={Boolean(this.getServerUrlValidationState())}
                                autoFocus={true}
                            />
                            <FormControl.Feedback/>
                            <FormText>
                                <FormattedMessage
                                    id='renderer.components.newServerModal.serverURL.description'
                                    defaultMessage='The URL of your Mattermost server. Must start with http:// or https://.'
                                />
                            </FormText>
                        </FormGroup>
                        <FormGroup className='NewServerModal-noBottomSpace'>
                            <FormLabel>
                                <FormattedMessage
                                    id='renderer.components.newServerModal.serverDisplayName'
                                    defaultMessage='Server Display Name'
                                />
                            </FormLabel>
                            <FormControl
                                id='serverNameInput'
                                type='text'
                                value={this.state.serverName}
                                placeholder={this.props.intl.formatMessage({id: 'renderer.components.newServerModal.serverDisplayName', defaultMessage: 'Server Display Name'})}
                                onChange={this.handleServerNameChange}
                                onClick={(e: React.MouseEvent<HTMLInputElement>) => {
                                    e.stopPropagation();
                                }}
                                isInvalid={Boolean(this.getServerNameValidationState())}
                            />
                            <FormControl.Feedback/>
                            <FormText className='NewServerModal-noBottomSpace'>
                                <FormattedMessage
                                    id='renderer.components.newServerModal.serverDisplayName.description'
                                    defaultMessage='The name of the server displayed on your desktop app tab bar.'
                                />
                            </FormText>
                        </FormGroup>
                    </form>
                </Modal.Body>

                <Modal.Footer>
                    <div
                        className='pull-left modal-error'
                    >
                        {this.getError()}
                    </div>

                    {this.props.onClose &&
                        <Button
                            id='cancelNewServerModal'
                            onClick={this.props.onClose}
                            variant='link'
                        >
                            <FormattedMessage
                                id='label.cancel'
                                defaultMessage='Cancel'
                            />
                        </Button>
                    }
                    {this.props.onSave &&
                        <Button
                            id='saveNewServerModal'
                            onClick={this.save}
                            disabled={!this.validateForm()}
                            variant='primary'
                        >
                            {this.getSaveButtonLabel()}
                        </Button>
                    }
                </Modal.Footer>

            </Modal>
        );
    }
}

export default injectIntl(NewServerModal);
