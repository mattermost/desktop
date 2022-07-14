// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import DestructiveConfirmationModal from './DestructiveConfirmModal';

type Props = {
    show: boolean;
    serverName: string;
    onHide: () => void;
    onAccept: React.MouseEventHandler<HTMLButtonElement>;
    onCancel: React.MouseEventHandler<HTMLButtonElement>;
};

function RemoveServerModal(props: Props) {
    const intl = useIntl();
    const {serverName, ...rest} = props;
    return (
        <DestructiveConfirmationModal
            {...rest}
            title={intl.formatMessage({id: 'renderer.components.removeServerModal.title', defaultMessage: 'Remove Server'})}
            acceptLabel={intl.formatMessage({id: 'label.remove', defaultMessage: 'Remove'})}
            cancelLabel={intl.formatMessage({id: 'label.cancel', defaultMessage: 'Cancel'})}
            body={(
                <Modal.Body>
                    <p>
                        <FormattedMessage
                            id='renderer.components.removeServerModal.body'
                            defaultMessage='This will remove the server from your Desktop App but will not delete any of its data - you can add the server back to the app at any time.'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='renderer.components.removeServerModal.confirm'
                            defaultMessage='Confirm you wish to remove the {serverName} server?'
                            values={{serverName}}
                        />
                    </p>
                </Modal.Body>
            )}
        />
    );
}

export default RemoveServerModal;
