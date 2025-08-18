// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import 'renderer/css/components/TopBar.scss';

type Props = {
    children?: React.ReactNode;
    darkMode: boolean;
    title?: string;
    openMenu: () => void;
    openPopoutMenu?: () => void;
}

const TopBar = ({children, darkMode, title, openMenu, openPopoutMenu}: Props) => {
    const intl = useIntl();
    const [fullScreen, setFullScreen] = useState(false);
    const [threeDotsIsFocused, setThreeDotsIsFocused] = useState(false);
    const topBar = useRef<HTMLDivElement>(null);
    const threeDotMenu = useRef<HTMLButtonElement>(null);

    const focusThreeDotsButton = () => {
        threeDotMenu.current?.focus();
        setThreeDotsIsFocused(true);
    };

    const unFocusThreeDotsButton = () => {
        threeDotMenu.current?.blur();
        setThreeDotsIsFocused(false);
    };

    const handleExitFullScreen = () => {
        if (!fullScreen) {
            return;
        }
        window.desktop.exitFullScreen();
    };

    useEffect(() => {
        window.desktop.onAppMenuWillClose(unFocusThreeDotsButton);
        window.desktop.getFullScreenStatus().then((fullScreenStatus) => setFullScreen(fullScreenStatus));
        window.desktop.onEnterFullScreen(() => setFullScreen(true));
        window.desktop.onLeaveFullScreen(() => setFullScreen(false));

        if (window.process.platform !== 'darwin') {
            window.desktop.onFocusThreeDotMenu(focusThreeDotsButton);
        }
    }, []);

    const topBarClassName = classNames('topBar', {
        macOS: window.process.platform === 'darwin',
        darkMode,
        fullScreen,
    });

    return (
        <div
            className={topBarClassName}
            onContextMenu={openPopoutMenu}
            onDoubleClick={() => window.desktop.doubleClickOnWindow()}
        >
            <div
                ref={topBar}
                className={'topBar-bg'}
            >
                <button
                    ref={threeDotMenu}
                    className='three-dot-menu'
                    onClick={openMenu}
                    onMouseOver={focusThreeDotsButton}
                    onMouseOut={unFocusThreeDotsButton}
                    tabIndex={0}
                    aria-label={intl.formatMessage({id: 'renderer.components.mainPage.contextMenu.ariaLabel', defaultMessage: 'Context menu'})}
                >
                    <i
                        className={classNames('icon-dots-vertical', {
                            isFocused: threeDotsIsFocused,
                        })}
                    />
                </button>
                {children}
                {title && (
                    <div className='app-title'>
                        {title}
                    </div>
                )}
                {window.process.platform !== 'darwin' && fullScreen && (
                    <div
                        className={`button full-screen-button${darkMode ? ' darkMode' : ''}`}
                        onClick={handleExitFullScreen}
                    >
                        <i className='icon icon-arrow-collapse'/>
                    </div>
                )}
                {window.process.platform !== 'darwin' && !fullScreen && (
                    <span style={{width: `${window.innerWidth - (window.navigator.windowControlsOverlay?.getTitlebarAreaRect().width ?? 0)}px`}}/>
                )}
            </div>
        </div>
    );
};

export default TopBar;
