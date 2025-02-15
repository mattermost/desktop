// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal, Button} from 'react-bootstrap';
import type {IntlShape} from 'react-intl';
import {FormattedMessage, injectIntl} from 'react-intl';

import {PERMISSION_DESCRIPTION} from 'common/permissions';
import {parseURL} from 'common/utils/url';
import {t} from 'common/utils/util';

import type {PermissionModalInfo} from 'types/modals';

type Props = {
    handleDeny: React.MouseEventHandler<HTMLButtonElement>;
    handleGrant: React.MouseEventHandler<HTMLButtonElement>;
    getPermissionInfo: () => Promise<PermissionModalInfo>;
    openExternalLink: (protocol: string, url: string) => void;
    intl: IntlShape;
};

type State = Partial<PermissionModalInfo>;

class PermissionModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {};
    }

    getPermissionInfo = async () => {
        const {url, permission} = await this.props.getPermissionInfo();
        this.setState({url, permission});
    };

    async componentDidMount() {
        await this.getPermissionInfo();
    }

    getModalTitle() {
        if (!this.state.permission) {
            return null;
        }

        const permission = this.props.intl.formatMessage({id: PERMISSION_DESCRIPTION[this.state.permission!]});
        return this.props.intl.formatMessage({id: 'renderer.modals.permission.permissionModal.title', defaultMessage: '{permission} Required'}, {permission});
    }

    getModalBody() {
        if (!this.state.permission) {
            return null;
        }

        const {url, permission} = this.state;
        const originDisplay = url ? parseURL(url)?.origin : this.props.intl.formatMessage({id: 'renderer.modals.permission.permissionModal.unknownOrigin', defaultMessage: 'unknown origin'});
        const originLink = originDisplay ?? '';

        const click = (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            let parseUrl;
            try {
                parseUrl = parseURL(originLink);
                this.props.openExternalLink(parseUrl!.protocol, originLink);
            } catch (err) {
                console.error(`invalid url ${originLink} supplied to externallink: ${err}`);
            }
        };

        return (
            <div>
                <p>
                    <FormattedMessage
                        id='renderer.modals.permission.permissionModal.body'
                        defaultMessage={'A site that\'s not included in your Mattermost server configuration requires access for {permission}.'}
                        values={{
                            permission: this.props.intl.formatMessage({id: PERMISSION_DESCRIPTION[permission!]}),
                        }}
                    />
                    {}
                </p>
                <p>
                    <FormattedMessage
                        id='renderer.modals.permission.permissionModal.requestOriginatedFromOrigin'
                        defaultMessage='This request originated from <link>{origin}</link>'
                        values={{
                            origin: originDisplay,
                            link: (msg: React.ReactNode) => (
                                <a

                                    onClick={click}
                                    href='#'
                                >
                                    {msg}
                                </a>
                            ),
                        }}
                    />
                </p>
            </div>
        );
    }

    render() {
        return (
            <Modal
                bsClass='modal'
                className='permission-modal'
                show={Boolean(this.state.url && this.state.permission)}
                id='requestPermissionModal'
                enforceFocus={true}
                onHide={() => {}}
            >
                <Modal.Header>
                    <Modal.Title>{this.getModalTitle()}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.getModalBody()}
                </Modal.Body>
                <Modal.Footer className={'remove-border'}>
                    <div>
                        <Button onClick={this.props.handleDeny}>
                            <FormattedMessage
                                id='label.cancel'
                                defaultMessage='Cancel'
                            />
                        </Button>
                        <Button
                            variant='primary'
                            onClick={this.props.handleGrant}
                        >
                            <FormattedMessage
                                id='label.accept'
                                defaultMessage='Accept'
                            />
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>
        );
    }
}

t('common.permissions.canBasicAuth');

export default injectIntl(PermissionModal);
