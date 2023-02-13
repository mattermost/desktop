// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';

export default function UrlDescription(props: {url: string}) {
    const urlRef = React.createRef<HTMLDivElement>();

    useEffect(() => {
        window.desktop.updateURLViewWidth(urlRef.current?.scrollWidth);
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
