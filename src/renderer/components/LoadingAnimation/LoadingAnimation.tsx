// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import LoadingIcon from './LoadingIcon';

import useAnimationEnd from '../../hooks/useAnimationEnd';

const LOADING_STATE = {
    INITIALIZING: 'initializing', // animation graphics are hidden
    LOADING: 'loading', // animation graphics fade in and animate
    LOADED: 'loaded', // animation graphics fade out
};

const ANIMATION_COMPLETION_DELAY = 500;

type Props = {
    loading: boolean;
    darkMode: boolean;
    onLoadAnimationComplete?: () => void;
}

/**
 * A function component for rendering the animated MM logo loading sequence
 * @param {boolean} loading - Prop that indicates whether currently loading or not
 * @param {boolean} darkMode - Prop that indicates if dark mode is enabled
 * @param {function} onLoadingAnimationComplete - Callback function to update when internal loading animation is complete
 */
function LoadingAnimation({
    loading = false,
    darkMode = false,
    onLoadAnimationComplete = undefined}: Props,
) {
    const loadingIconContainerRef = React.useRef(null);
    const [animationState, setAnimationState] = React.useState(LOADING_STATE.INITIALIZING);
    const [loadingAnimationComplete, setLoadingAnimationComplete] = React.useState(false);

    React.useEffect(() => {
        if (loading) {
            setAnimationState(LOADING_STATE.LOADING);
            setLoadingAnimationComplete(false);
        }

        // in order for the logo animation to fully complete before fading out, the LOADED state is not set until
        // both the external loaded prop changes back to false and the internal loading animation is complete
        if (!loading && loadingAnimationComplete) {
            setAnimationState(LOADING_STATE.LOADED);
        }
    }, [loading]);

    React.useEffect(() => {
    // in order for the logo animation to fully complete before fading out, the LOADED state is not set until
    // both the external loaded prop goes back to false and the internal loading animation is complete
        if (!loading && loadingAnimationComplete) {
            setAnimationState(LOADING_STATE.LOADED);
        }
    }, [loadingAnimationComplete]);

    // listen for end of the css logo animation sequence
    useAnimationEnd<HTMLDivElement>(loadingIconContainerRef, () => {
        setTimeout(() => {
            setLoadingAnimationComplete(true);
        }, ANIMATION_COMPLETION_DELAY);
    }, 'LoadingAnimation__compass-shrink');

    // listen for end of final css logo fade/shrink animation sequence
    useAnimationEnd<HTMLDivElement>(loadingIconContainerRef, () => {
        if (onLoadAnimationComplete) {
            onLoadAnimationComplete();
        }
        setAnimationState(LOADING_STATE.INITIALIZING);
    }, 'LoadingAnimation__shrink');

    return (
        <div
            ref={loadingIconContainerRef}
            className={classNames('LoadingAnimation', {
                'LoadingAnimation--darkMode': darkMode,
                'LoadingAnimation--spinning': animationState !== LOADING_STATE.INITIALIZING,
                'LoadingAnimation--loading': animationState === LOADING_STATE.LOADING,
                'LoadingAnimation--loaded': animationState === LOADING_STATE.LOADED,
            })}
        >
            <LoadingIcon/>
        </div>
    );
}

export default LoadingAnimation;
