// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import setupDarkMode from './modals/darkMode';

import 'renderer/css/components/PopoutWindow.scss';

setupDarkMode();

const PopoutWindow: React.FC = () => {
    const [title, setTitle] = useState<string>('');

    useEffect(() => {
        // Get the view ID from the URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const viewId = urlParams.get('viewId');

        if (viewId) {
            // Get the view title from the main process
            window.desktop.getViewTitle(viewId).then((viewTitle: string | null) => {
                if (viewTitle) {
                    setTitle(viewTitle);
                }
            });

            // Listen for title updates
            window.desktop.onUpdateTabTitle((updatedViewId: string, updatedTitle: string) => {
                if (updatedViewId === viewId) {
                    setTitle(updatedTitle);
                }
            });
        }
    }, []);

    return (
        <div className='PopoutWindow'>
            <div className='PopoutWindow__header'>
                <div className='PopoutWindow__header-title'>{title}</div>
            </div>
            <div className='PopoutWindow__content'>
                {/* The webContents will be attached here by the main process */}
            </div>
        </div>
    );
};

ReactDOM.render(
    <PopoutWindow/>,
    document.getElementById('app'),
);
