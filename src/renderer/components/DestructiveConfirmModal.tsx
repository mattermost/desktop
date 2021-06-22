// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import {Button, Modal} from 'react-bootstrap';

type Props = {
    title: string;
    body: React.ReactNode;
    acceptLabel: string;
    cancelLabel: string;
    onHide: () => void;
    onAccept: React.MouseEventHandler<Button>;
    onCancel: React.MouseEventHandler<Button>;
};

export default function DestructiveConfirmationModal(props: Props) {
    const {
        title,
        body,
        acceptLabel,
        cancelLabel,
        onAccept,
        onCancel,
        onHide,
        ...rest} = props;
    return (
        <Modal
            onHide={onHide}
            {...rest}
        >
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
