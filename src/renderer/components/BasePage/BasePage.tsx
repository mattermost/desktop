// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ConnectionErrorView from 'renderer/components/ConnectionErrorView';
import BackgroundImage from 'renderer/components/Images/background';
import IncompatibleErrorView from 'renderer/components/IncompatibleErrorView';
import TopBar from 'renderer/components/TopBar';

import './BasePage.scss';

type Props = {
    children?: React.ReactNode;
    appName: string;
    title?: string;
    errorUrl?: string;
    errorState?: ErrorState;
    errorMessage?: string;
    openMenu: () => void;
    openPopoutMenu?: () => void;
};

export enum ErrorState {
    FAILED = 'failed',
    INCOMPATIBLE = 'incompatible',
}

export default function BasePage({
    children,
    appName,
    errorUrl,
    openMenu,
    openPopoutMenu,
    title,
    errorState,
    errorMessage,
}: Props) {
    let errorComponent;
    if (errorState === ErrorState.FAILED) {
        errorComponent = (
            <ConnectionErrorView
                errorInfo={errorMessage}
                url={errorUrl}
                appName={appName}
                handleLink={window.desktop.openServerExternally}
            />
        );
    } else if (errorState === ErrorState.INCOMPATIBLE) {
        errorComponent = (
            <IncompatibleErrorView
                url={errorUrl}
                appName={appName}
                handleLink={window.desktop.openServerExternally}
                handleUpgradeLink={window.desktop.openServerUpgradeLink}
            />
        );
    }

    return (
        <>
            <BackgroundImage/>
            <div className='BasePage'>
                <TopBar
                    title={title}
                    openMenu={openMenu}
                    openPopoutMenu={openPopoutMenu}
                >
                    {children}
                </TopBar>
                <div className='BasePage__body'>
                    {errorComponent}
                </div>
            </div>
        </>
    );
}
