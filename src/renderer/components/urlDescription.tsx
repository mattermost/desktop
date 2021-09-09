// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export default function UrlDescription(props: {url: string}) {
    if (props.url) {
        return (
            <div className='HoveringURL HoveringURL-left'>
                <p>{props.url}</p>
            </div>
        );
    }

    return null;
}
