// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Button, Modal} from 'react-bootstrap';

import DestructiveConfirmationModal from './DestructiveConfirmModal';

type Props = {
    show: boolean;
    serverName: string;
    onHide: () => void;
    onAccept: React.MouseEventHandler<Button>;
    onCancel: React.MouseEventHandler<Button>;
}

export default function RemoveServerModal(props: Props) {
    const {serverName, ...rest} = props;
    return (
        <DestructiveConfirmationModal
            {...rest}
            title='Remove Server'
            acceptLabel='Remove'
            cancelLabel='Cancel'
            body={(
                <Modal.Body>
                    <p>
                        {'This will remove the server from your Desktop App but will not delete any of its data' +
          ' - you can add the server back to the app at any time.'}
                    </p>
                    <p>
                        {'Confirm you wish to remove the '}<strong>{serverName}</strong>{' server?'}
                    </p>
                </Modal.Body>
            )}
        />
    );
}
