// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import 'renderer/css/components/UrlView.scss';

export default function UrlView() {
    const urlRef = useRef<HTMLDivElement>(null);

    const [url, setUrl] = useState<string | undefined>();

    useEffect(() => {
        window.desktop.onSetURLForURLView((newUrl) => {
            setUrl(newUrl);
        });
    }, []);

    useEffect(() => {
        if (url) {
            window.desktop.updateURLViewWidth(urlRef.current?.scrollWidth);
        }
    }, [url]);

    if (url) {
        return (
            <div
                ref={urlRef}
                className='UrlView'
            >
                <p>{url}</p>
            </div>
        );
    }

    return null;
}
