// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

import React, {useEffect} from 'react';
import ReactDOM from 'react-dom';

import './urlView.scss';

function UrlDescription(props: {url: string}) {
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

const start = async () => {
    ReactDOM.render(
        <UrlDescription
            url={decodeURIComponent(urlParams.get('url')!)}
        />,
        document.getElementById('app'),
    );
};

start();
