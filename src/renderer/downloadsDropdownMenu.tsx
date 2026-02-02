// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

import type {DownloadedItem} from 'types/downloads';

import IntlProvider from './intl_provider';
import setupDarkMode from './modals/darkMode';

import './css/downloadsDropdownMenu.scss';

setupDarkMode();

const DownloadsDropdownMenu = () => {
    const [item, setItem] = useState<DownloadedItem | null>(null);

    const handleUpdate = (item: DownloadedItem) => {
        setItem(item);
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

    const viewChangelog = useCallback(() => {
        if (!item) {
            return;
        }
        if (item?.type !== 'update') {
            return;
        }
        window.desktop.openChangelogLink();
        window.desktop.closeDownloadsDropdownMenu();
    }, [item]);

    const skipVersion = useCallback(() => {
        if (!item) {
            return;
        }
        if (item?.type !== 'update') {
            return;
        }
        window.desktop.skipVersion();
        window.desktop.closeDownloadsDropdownMenu();
    }, [item]);

    const isUpdate = item?.type === 'update';

    return (
        <IntlProvider>
            <div
                onClick={preventPropagation}
                className='DownloadsDropdownMenu'
            >
                {isUpdate ? (
                    <>
                        <div
                            className='DownloadsDropdownMenu__MenuItem'
                            onClick={viewChangelog}
                        >
                            <FormattedMessage
                                id='renderer.downloadsDropdown.Update.ViewChangelog'
                                defaultMessage='View changelog'
                            />
                        </div>
                        <div
                            className='DownloadsDropdownMenu__MenuItem'
                            onClick={skipVersion}
                        >
                            <FormattedMessage
                                id='renderer.downloadsDropdown.Update.SkipThisVersion'
                                defaultMessage='Skip this version'
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div
                            className='DownloadsDropdownMenu__MenuItem'
                            onClick={openFile}
                        >
                            <FormattedMessage
                                id='renderer.downloadsDropdownMenu.Open'
                                defaultMessage='Open'
                            />
                        </div>
                        <div
                            className='DownloadsDropdownMenu__MenuItem'
                            onClick={showInFolder}
                        >
                            {getOSFileManager()}
                        </div>
                        <div
                            className='DownloadsDropdownMenu__MenuItem'
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
                    </>
                )}
            </div>
        </IntlProvider>
    );
};

ReactDOM.render(
    <DownloadsDropdownMenu/>,
    document.getElementById('app'),
);
