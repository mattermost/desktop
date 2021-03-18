// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import propTypes from 'prop-types';
import {Button, Navbar, ProgressBar} from 'react-bootstrap';

function InstallButton(props) {
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

InstallButton.propTypes = {
    notifyOnly: propTypes.bool.isRequired,
    onClickInstall: propTypes.func.isRequired,
    onClickDownload: propTypes.func.isRequired,
};

function UpdaterPage(props) {
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

UpdaterPage.propTypes = {
    appName: propTypes.string.isRequired,
    notifyOnly: propTypes.bool.isRequired,
    isDownloading: propTypes.bool.isRequired,
    progress: propTypes.number,
    onClickInstall: propTypes.func.isRequired,
    onClickDownload: propTypes.func.isRequired,
    onClickReleaseNotes: propTypes.func.isRequired,
    onClickRemind: propTypes.func.isRequired,
    onClickSkip: propTypes.func.isRequired,
    onClickCancel: propTypes.func.isRequired,
};

export default UpdaterPage;
