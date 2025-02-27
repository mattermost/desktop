// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import DestructiveConfirmationModal from './DestructiveConfirmModal';

type Props = {
    show: boolean;
    onHide: () => void;
    onAccept: () => void;
    onCancel: () => void;
};

function RemoveServerModal(props: Props) {
    const intl = useIntl();
    const {...rest} = props;
    return (
        <DestructiveConfirmationModal
            {...rest}
            id='removeServerModal'
            title={intl.formatMessage({id: 'renderer.components.removeServerModal.title', defaultMessage: 'Remove Server'})}
            acceptLabel={intl.formatMessage({id: 'label.remove', defaultMessage: 'Remove'})}
            cancelLabel={intl.formatMessage({id: 'label.cancel', defaultMessage: 'Cancel'})}
            body={(
                <>
                    <FormattedMessage
                        id='renderer.components.removeServerModal.body'
                        defaultMessage='This will remove the server from your Desktop App but will not delete any of its data - you can add the server back at any time.'
                    />
                    <br/><br/>
                    <FormattedMessage
                        id='renderer.components.removeServerModal.confirm'
                        defaultMessage='Are you sure you wish to remove the server?'
                    />
                </>
            )}
        />
    );
}

export default RemoveServerModal;
