// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal, Button} from 'react-bootstrap';
import PropTypes from 'prop-types';

import urlUtil from 'common/utils/url';
import {MODAL_INFO} from 'common/communication';
import {PERMISSION_DESCRIPTION} from 'common/permissions';

export default class PermissionModal extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        window.addEventListener('message', this.handlePermissionInfoMessage);

        this.props.getPermissionInfo();
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.handlePermissionInfoMessage);
    }

    handlePermissionInfoMessage = (event) => {
        switch (event.data.type) {
        case MODAL_INFO: {
            const {url, permission} = event.data.data;
            this.setState({url, permission});
            break;
        }
        default:
            break;
        }
    }

    getModalTitle() {
        return `${PERMISSION_DESCRIPTION[this.state.permission]} Required`;
    }

    getModalBody() {
        const {url, permission} = this.state;
        const originDisplay = url ? urlUtil.getHost(url) : 'unknown origin';
        const originLink = url ? originDisplay : '';

        const click = (e) => {
            e.preventDefault();
            let parseUrl;
            try {
                parseUrl = urlUtil.parseURL(originLink);
                this.props.openExternalLink(parseUrl.protocol, originLink);
            } catch (err) {
                console.error(`invalid url ${originLink} supplied to externallink: ${err}`);
            }
        };

        return (
            <div>
                <p>
                    {`A site that's not included in your Mattermost server configuration requires access for ${PERMISSION_DESCRIPTION[permission]}.`}
                </p>
                <p>
                    <span>{'This request originated from '}</span>
                    <a onClick={click}>{originDisplay}</a>
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
            >
                <Modal.Header>
                    <Modal.Title>{this.getModalTitle()}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.getModalBody()}
                </Modal.Body>
                <Modal.Footer className={'remove-border'}>
                    <div>
                        <Button
                            onClick={this.props.handleDeny}
                        >{'Cancel'}</Button>
                        <Button
                            bsStyle='primary'
                            onClick={this.props.handleGrant}
                        >{'Accept'}</Button>
                    </div>
                </Modal.Footer>
            </Modal>
        );
    }
}

PermissionModal.propTypes = {
    handleDeny: PropTypes.func,
    handleGrant: PropTypes.func,
    getPermissionInfo: PropTypes.func,
    openExternalLink: PropTypes.func,
};
