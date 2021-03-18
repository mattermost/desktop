// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import PropTypes from 'prop-types';
import {Modal} from 'react-bootstrap';

import DestructiveConfirmationModal from './DestructiveConfirmModal.jsx';

export default function RemoveServerModal(props) {
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

RemoveServerModal.propTypes = {
    serverName: PropTypes.string.isRequired,
};
