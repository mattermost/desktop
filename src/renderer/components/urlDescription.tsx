// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';

import {UPDATE_URL_VIEW_WIDTH} from 'common/communication';

export default function UrlDescription(props: {url: string}) {
    const urlRef = React.createRef<HTMLDivElement>();

    useEffect(() => {
        window.postMessage({type: UPDATE_URL_VIEW_WIDTH, data: urlRef.current?.scrollWidth}, window.location.href);
    }, []);

    if (props.url) {
        return (
            <div
                ref={urlRef}
                className='HoveringURL HoveringURL-left'
            >
                <p>{props.url}</p>
            </div>
        );
    }

    return null;
}
