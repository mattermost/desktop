// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal, Button, FormGroup, FormControl, FormLabel, FormText} from 'react-bootstrap';
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl';

import {TeamWithIndex} from 'types/config';

import urlUtils from 'common/utils/url';
import {PING_DOMAIN, PING_DOMAIN_RESPONSE} from 'common/communication';

type Props = {
    onClose?: () => void;
    onSave?: (team: TeamWithIndex) => void;
    team?: TeamWithIndex;
    currentTeams?: TeamWithIndex[];
    editMode?: boolean;
    show?: boolean;
    restoreFocus?: boolean;
    currentOrder?: number;
    setInputRef?: (inputRef: HTMLInputElement) => void;
    intl: IntlShape;
};

type State = {
    teamName: string;
    teamUrl: string;
    teamIndex?: number;
    teamOrder: number;
    saveStarted: boolean;
}

class NewTeamModal extends React.PureComponent<Props, State> {
    wasShown?: boolean;
    teamUrlInputRef?: HTMLInputElement;

    static defaultProps = {
        restoreFocus: true,
    };

    constructor(props: Props) {
        super(props);

        this.wasShown = false;
        this.state = {
            teamName: '',
            teamUrl: '',
            teamOrder: props.currentOrder || 0,
            saveStarted: false,
        };
    }

    initializeOnShow() {
        this.setState({
            teamName: this.props.team ? this.props.team.name : '',
            teamUrl: this.props.team ? this.props.team.url : '',
            teamIndex: this.props.team?.index,
            teamOrder: this.props.team ? this.props.team.order : (this.props.currentOrder || 0),
            saveStarted: false,
        });
    }

    getTeamNameValidationError() {
        if (!this.state.saveStarted) {
            return null;
        }
        if (this.props.currentTeams) {
            const currentTeams = [...this.props.currentTeams];
            if (this.props.editMode && this.props.team) {
                currentTeams.splice(this.props.team.index, 1);
            }
            if (currentTeams.find((team) => team.name === this.state.teamName)) {
                return (
                    <FormattedMessage
                        id='renderer.components.newTeamModal.error.serverNameExists'
                        defaultMessage='A server with the same name already exists.'
                    />
                );
            }
        }
        return this.state.teamName.length > 0 ? null : (
            <FormattedMessage
                id='renderer.components.newTeamModal.error.nameRequired'
                defaultMessage='Name is required.'
            />
        );
    }

    getTeamNameValidationState() {
        return this.getTeamNameValidationError() === null ? null : 'error';
    }

    handleTeamNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            teamName: e.target.value,
        });
    }

    getTeamUrlValidationError() {
        if (!this.state.saveStarted) {
            return null;
        }
        if (this.props.currentTeams) {
            const currentTeams = [...this.props.currentTeams];
            if (this.props.editMode && this.props.team) {
                currentTeams.splice(this.props.team.index, 1);
            }
            if (currentTeams.find((team) => team.url === this.state.teamUrl)) {
                return (
                    <FormattedMessage
                        id='renderer.components.newTeamModal.error.serverUrlExists'
                        defaultMessage='A server with the same URL already exists.'
                    />
                );
            }
        }
        if (this.state.teamUrl.length === 0) {
            return (
                <FormattedMessage
                    id='renderer.components.newTeamModal.error.urlRequired'
                    defaultMessage='URL is required.'
                />
            );
        }
        if (!(/^https?:\/\/.*/).test(this.state.teamUrl.trim())) {
            return (
                <FormattedMessage
                    id='renderer.components.newTeamModal.error.urlNeedsHttp'
                    defaultMessage='URL should start with http:// or https://.'
                />
            );
        }
        if (!urlUtils.isValidURL(this.state.teamUrl.trim())) {
            return (
                <FormattedMessage
                    id='renderer.components.newTeamModal.error.urlIncorrectFormatting'
                    defaultMessage='URL is not formatted correctly.'
                />
            );
        }
        return null;
    }

    getTeamUrlValidationState() {
        return this.getTeamUrlValidationError() === null ? null : 'error';
    }

    handleTeamUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const teamUrl = e.target.value;
        this.setState({teamUrl});
    }

    addProtocolToUrl = (teamUrl: string): Promise<void> => {
        if (teamUrl.startsWith('http://') || teamUrl.startsWith('https://')) {
            return Promise.resolve(undefined);
        }

        return new Promise((resolve) => {
            const handler = (event: {data: {type: string; data: string | Error}}) => {
                if (event.data.type === PING_DOMAIN_RESPONSE) {
                    if (event.data.data instanceof Error) {
                        console.error(`Could not ping url: ${teamUrl}`);
                    } else {
                        this.setState({teamUrl: `${event.data.data}://${this.state.teamUrl}`});
                    }
                    window.removeEventListener('message', handler);
                    resolve(undefined);
                }
            };
            window.addEventListener('message', handler);
            window.postMessage({type: PING_DOMAIN, data: teamUrl}, window.location.href);
        });
    }

    getError() {
        const nameError = this.getTeamNameValidationError();
        const urlError = this.getTeamUrlValidationError();

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
        return this.getTeamNameValidationState() === null &&
            this.getTeamUrlValidationState() === null;
    }

    save = async () => {
        await this.addProtocolToUrl(this.state.teamUrl);
        this.setState({
            saveStarted: true,
        }, () => {
            if (this.validateForm()) {
                this.props.onSave?.({
                    url: this.state.teamUrl,
                    name: this.state.teamName,
                    index: this.state.teamIndex!,
                    order: this.state.teamOrder,
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
                    id='renderer.components.newTeamModal.title.edit'
                    defaultMessage='Edit Server'
                />
            );
        }
        return (
            <FormattedMessage
                id='renderer.components.newTeamModal.title.add'
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
                className='NewTeamModal'
                show={this.props.show}
                id='newServerModal'
                enforceFocus={true}
                onEntered={() => this.teamUrlInputRef?.focus()}
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
                                    id='renderer.components.newTeamModal.serverURL'
                                    defaultMessage='Server URL'
                                />
                            </FormLabel>
                            <FormControl
                                id='teamUrlInput'
                                type='text'
                                value={this.state.teamUrl}
                                placeholder='https://example.com'
                                onChange={this.handleTeamUrlChange}
                                onClick={(e: React.MouseEvent<HTMLInputElement>) => {
                                    e.stopPropagation();
                                }}
                                ref={(ref: HTMLInputElement) => {
                                    this.teamUrlInputRef = ref;
                                    if (this.props.setInputRef) {
                                        this.props.setInputRef(ref);
                                    }
                                }}
                                isInvalid={Boolean(this.getTeamUrlValidationState())}
                                autoFocus={true}
                            />
                            <FormControl.Feedback/>
                            <FormText>
                                <FormattedMessage
                                    id='renderer.components.newTeamModal.serverURL.description'
                                    defaultMessage='The URL of your Mattermost server. Must start with http:// or https://.'
                                />
                            </FormText>
                        </FormGroup>
                        <FormGroup className='NewTeamModal-noBottomSpace'>
                            <FormLabel>
                                <FormattedMessage
                                    id='renderer.components.newTeamModal.serverDisplayName'
                                    defaultMessage='Server Display Name'
                                />
                            </FormLabel>
                            <FormControl
                                id='teamNameInput'
                                type='text'
                                value={this.state.teamName}
                                placeholder={this.props.intl.formatMessage({id: 'renderer.components.newTeamModal.serverDisplayName', defaultMessage: 'Server Display Name'})}
                                onChange={this.handleTeamNameChange}
                                onClick={(e: React.MouseEvent<HTMLInputElement>) => {
                                    e.stopPropagation();
                                }}
                                isInvalid={Boolean(this.getTeamNameValidationState())}
                            />
                            <FormControl.Feedback/>
                            <FormText className='NewTeamModal-noBottomSpace'>
                                <FormattedMessage
                                    id='renderer.components.newTeamModal.serverDisplayName.description'
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

export default injectIntl(NewTeamModal);
