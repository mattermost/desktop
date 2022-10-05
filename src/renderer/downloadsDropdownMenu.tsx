// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';

import {DownloadedItem} from 'types/downloads';

import {
    DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD,
    DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE,
    DOWNLOADS_DROPDOWN_MENU_OPEN_FILE,
    DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER,
    REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO,
    UPDATE_DOWNLOADS_DROPDOWN_MENU,
} from 'common/communication';

import IntlProvider from './intl_provider';

import './css/downloadsDropdownMenu.scss';

const DownloadsDropdownMenu = () => {
    const [item, setItem] = useState<DownloadedItem | null>(null);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const handleMessageEvent = (event: MessageEvent) => {
            if (event.data.type === UPDATE_DOWNLOADS_DROPDOWN_MENU) {
                const {item, darkMode} = event.data.data;
                setItem(item);
                setDarkMode(darkMode);
            }
        };

        window.addEventListener('message', handleMessageEvent);
        window.postMessage({type: REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO}, window.location.href);
        return () => {
            window.removeEventListener('message', handleMessageEvent);
        };
    }, []);

    const preventPropagation = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const getOSFileManager = () => {
        switch (window.process.platform) {
        case 'darwin':
            return (
                <FormattedMessage
                    id='renderer.downloadsDropdownMenu.ShowInFinder'
                    defaultMessage='Show in Finder'
                />);
        case 'linux':
            return (
                <FormattedMessage
                    id='renderer.downloadsDropdownMenu.ShowInFileManager'
                    defaultMessage='Show in File Manager'
                />);
        case 'win32':
            return (
                <FormattedMessage
                    id='renderer.downloadsDropdownMenu.ShowInFileExplorer'
                    defaultMessage='Show in File Explorer'
                />);

        default:
            return (
                <FormattedMessage
                    id='renderer.downloadsDropdownMenu.ShowInFolder'
                    defaultMessage='Show in Folder'
                />);
        }
    };

    const openFile = useCallback(() => {
        if (item?.type === 'update') {
            return;
        }
        window.postMessage({type: DOWNLOADS_DROPDOWN_MENU_OPEN_FILE, payload: {item}}, window.location.href);
    }, [item]);

    const showInFolder = useCallback(() => {
        if (item?.type === 'update') {
            return;
        }
        window.postMessage({type: DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER, payload: {item}}, window.location.href);
    }, [item]);

    const clearFile = useCallback(() => {
        if (item?.type === 'update') {
            return;
        }
        window.postMessage({type: DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE, payload: {item}}, window.location.href);
    }, [item]);

    const cancelDownload = useCallback(() => {
        if (item?.state !== 'progressing') {
            return;
        }
        window.postMessage({type: DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD, payload: {item}}, window.location.href);
    }, [item]);

    return (
        <IntlProvider>
            <div
                onClick={preventPropagation}
                className={classNames('DownloadsDropdownMenu', {
                    darkMode,
                })}
            >
                <div
                    className={classNames('DownloadsDropdownMenu__MenuItem', {
                        disabled: item?.type === 'update',
                    })}
                    onClick={openFile}
                >
                    <FormattedMessage
                        id='renderer.downloadsDropdownMenu.Open'
                        defaultMessage='Open'
                    />
                </div>
                <div
                    className={classNames('DownloadsDropdownMenu__MenuItem', {
                        disabled: item?.type === 'update',
                    })}
                    onClick={showInFolder}
                >
                    {getOSFileManager()}
                </div>
                <div
                    className={classNames('DownloadsDropdownMenu__MenuItem', {
                        disabled: item?.type === 'update',
                    })}
                    onClick={clearFile}
                >
                    <FormattedMessage
                        id='renderer.downloadsDropdownMenu.Clear'
                        defaultMessage='Clear'
                    />
                </div>
                <div
                    className={classNames('DownloadsDropdownMenu__MenuItem', {
                        disabled: item?.state !== 'progressing',
                    })}
                    onClick={cancelDownload}
                >
                    <FormattedMessage
                        id='renderer.downloadsDropdownMenu.CancelDownload'
                        defaultMessage='Cancel Download'
                    />
                </div>
            </div>
        </IntlProvider>
    );
};

ReactDOM.render(
    <DownloadsDropdownMenu/>,
    document.getElementById('app'),
);
