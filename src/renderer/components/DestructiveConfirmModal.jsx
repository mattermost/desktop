// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import PropTypes from 'prop-types';
import {Button, Modal} from 'react-bootstrap';

export default function DestructiveConfirmationModal(props) {
    const {
        title,
        body,
        acceptLabel,
        cancelLabel,
        onAccept,
        onCancel,
        ...rest} = props;
    return (
        <Modal {...rest}>
            <Modal.Header closeButton={true}>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            {body}
            <Modal.Footer>
                <Button
                    bsStyle='link'
                    onClick={onCancel}
                >{cancelLabel}</Button>
                <Button
                    bsStyle='danger'
                    onClick={onAccept}
                >{acceptLabel}</Button>
            </Modal.Footer>
        </Modal>
    );
}

DestructiveConfirmationModal.propTypes = {
    title: PropTypes.string.isRequired,
    body: PropTypes.node.isRequired,
    acceptLabel: PropTypes.string.isRequired,
    cancelLabel: PropTypes.string.isRequired,
    onAccept: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};
