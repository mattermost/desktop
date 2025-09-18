// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import LoadingAnimation from 'renderer/components/LoadingAnimation';
import LoadingBackground from 'renderer/components/LoadingScreen/LoadingBackground';

import useTransitionEnd from '../../hooks/useTransitionEnd';

import './LoadingScreen.scss';

type Props = {
    loading?: boolean;
    onFadeOutComplete?: () => void;
};

/**
 * A function component for rendering the desktop app loading screen
 * @param {boolean} loading - Prop that indicates whether currently loading or not
 * @param {boolean} darkMode - Prop that indicates if dark mode is enabled
 * @param {() => void} onFadeOutComplete - Function to call when the loading animation is completely finished
 */
function LoadingScreen({loading = false, onFadeOutComplete = () => null}: Props) {
    const loadingScreenRef = React.useRef(null);

    const [loadingIsComplete, setLoadingIsComplete] = React.useState(true);
    const [loadAnimationIsComplete, setLoadAnimationIsComplete] = React.useState(true);
    const [fadeOutIsComplete, setFadeOutIsComplete] = React.useState(true);

    React.useEffect(() => {
    // reset internal state if loading restarts
        if (loading) {
            resetState();
        } else {
            setLoadingIsComplete(true);
        }
    }, [loading]);

    function handleLoadAnimationComplete() {
        setLoadAnimationIsComplete(true);
    }

    useTransitionEnd<HTMLDivElement>(loadingScreenRef, React.useCallback(() => {
        setFadeOutIsComplete(true);
        onFadeOutComplete();
    }, []), ['opacity']);

    function loadingInProgress() {
        return !(loadingIsComplete && loadAnimationIsComplete && fadeOutIsComplete);
    }

    function resetState() {
        setLoadingIsComplete(false);
        setLoadAnimationIsComplete(false);
        setFadeOutIsComplete(false);
    }

    const loadingScreen = (
        <div
            ref={loadingScreenRef}
            className={classNames('LoadingScreen', {
                'LoadingScreen--loaded': loadingIsComplete && loadAnimationIsComplete,
            })}
        >
            <LoadingBackground/>
            <LoadingAnimation
                loading={loading}
                onLoadAnimationComplete={handleLoadAnimationComplete}
            />
        </div>
    );

    return loadingInProgress() ? loadingScreen : null;
}

export default LoadingScreen;
