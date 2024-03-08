// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

import type {DownloadedItem} from 'types/downloads';

import IntlProvider from './intl_provider';

import './css/downloadsDropdownMenu.scss';

const DownloadsDropdownMenu = () => {
    const [item, setItem] = useState<DownloadedItem | null>(null);
    const [darkMode, setDarkMode] = useState(false);

    const handleUpdate = (item: DownloadedItem, darkMode: boolean) => {
        setItem(item);
        setDarkMode(darkMode);
    };

    useEffect(() => {
        window.desktop.downloadsDropdownMenu.requestInfo();
        window.desktop.downloadsDropdownMenu.onUpdateDownloadsDropdownMenu(handleUpdate);
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
        if (!item) {
            return;
        }
        if (item?.type === 'update') {
            return;
        }
        window.desktop.downloadsDropdownMenu.openFile(item);
    }, [item]);

    const showInFolder = useCallback(() => {
        if (!item) {
            return;
        }
        if (item?.type === 'update') {
            return;
        }
        window.desktop.downloadsDropdownMenu.showInFolder(item);
    }, [item]);

    const clearFile = useCallback(() => {
        if (!item) {
            return;
        }
        if (item?.type === 'update') {
            return;
        }
        window.desktop.downloadsDropdownMenu.clearFile(item);
    }, [item]);

    const cancelDownload = useCallback(() => {
        if (!item) {
            return;
        }
        if (item?.state !== 'progressing') {
            return;
        }
        window.desktop.downloadsDropdownMenu.cancelDownload(item);
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
