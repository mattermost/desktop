// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import {Button, Navbar, ProgressBar} from 'react-bootstrap';

type InstallButtonProps = {
    notifyOnly: boolean;
    onClickInstall: React.MouseEventHandler<Button>;
    onClickDownload: React.MouseEventHandler<Button>;
};

function InstallButton(props: InstallButtonProps) {
    if (props.notifyOnly) {
        return (
            <Button
                bsStyle='primary'
                onClick={props.onClickDownload}
            >{'Download Update'}</Button>
        );
    }
    return (
        <Button
            bsStyle='primary'
            onClick={props.onClickInstall}
        >{'Install Update'}</Button>
    );
}

type UpdaterPageProps = {
    appName: string;
    notifyOnly: boolean;
    isDownloading?: boolean;
    progress?: number;
    onClickInstall: React.MouseEventHandler<Button>;
    onClickDownload: React.MouseEventHandler<Button>;
    onClickReleaseNotes: React.MouseEventHandler<HTMLAnchorElement>;
    onClickRemind: React.MouseEventHandler<Button>;
    onClickSkip: React.MouseEventHandler<Button>;
    onClickCancel: React.MouseEventHandler<Button>;
};

function UpdaterPage(props: UpdaterPageProps) {
    let footer;
    if (props.isDownloading) {
        footer = (
            <Navbar
                className='UpdaterPage-footer'
                fixedBottom={true}
                fluid={true}
            >
                <ProgressBar
                    active={true}
                    now={props.progress}
                    label={`${props.progress}%`}
                />
                <div className='pull-right'>
                    <Button
                        onClick={props.onClickCancel}
                    >{'Cancel'}</Button>
                </div>
            </Navbar>
        );
    } else {
        footer = (
            <Navbar
                className='UpdaterPage-footer'
                fixedBottom={true}
                fluid={true}
            >
                <Button
                    className='UpdaterPage-skipButton'
                    bsStyle='link'
                    onClick={props.onClickSkip}
                >{'Skip this version'}</Button>
                <div className='pull-right'>
                    <Button
                        bsStyle='link'
                        onClick={props.onClickRemind}
                    >{'Remind me in 2 days'}</Button>
                    <InstallButton
                        notifyOnly={props.notifyOnly}
                        onClickInstall={props.onClickInstall}
                        onClickDownload={props.onClickDownload}
                    />
                </div>
            </Navbar>
        );
    }

    return (
        <div className='UpdaterPage'>
            <Navbar fluid={true} >
                <h1 className='UpdaterPage-heading'>{'New update is available'}</h1>
            </Navbar>
            <div className='container-fluid'>
                <p>{`A new version of the ${props.appName} is available!`}</p>
                <p>{'Read the '}
                    <a
                        href='#'
                        onClick={props.onClickReleaseNotes}
                    >{'release notes'}</a>
                    {' to learn more.'}
                </p>
            </div>
            {footer}
        </div>
    );
}

export default UpdaterPage;
