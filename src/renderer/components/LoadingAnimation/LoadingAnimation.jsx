// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import useAnimationEnd from '../../hooks/useAnimationEnd.js';

import LoadingIcon from './LoadingIcon.jsx';

const LOADING_STATE = {
    INITIALIZING: 'initializing', // animation graphics are hidden
    LOADING: 'loading', // animation graphics fade in and animate
    LOADED: 'loaded', // animation graphics fade out
    COMPLETE: 'complete', // animation graphics are removed from the DOM
};

const ANIMATION_COMPLETION_DELAY = 500;

/**
 * A function component for rendering the animated MM logo loading sequence
 * @param {boolean} loading - Prop that indicates whether currently loading or not
 * @param {boolean} darkMode - Prop that indicates if dark mode is enabled
 * @param {function} onLoadingAnimationComplete - Callback function to update when internal loading animation is complete
 */
function LoadingAnimation({
    loading = false,
    darkMode = false,
    onLoadAnimationComplete = null},
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
    useAnimationEnd(loadingIconContainerRef, () => {
        setTimeout(() => {
            setLoadingAnimationComplete(true);
        }, ANIMATION_COMPLETION_DELAY);
    }, 'LoadingAnimation__compass-shrink');

    // listen for end of final css logo fade/shrink animation sequence
    useAnimationEnd(loadingIconContainerRef, () => {
        if (onLoadAnimationComplete) {
            onLoadAnimationComplete();
        }
        setAnimationState(LOADING_STATE.COMPLETE);
    }, 'LoadingAnimation__shrink');

    return (
        <div
            ref={loadingIconContainerRef}
            className={classNames('LoadingAnimation', {
                'LoadingAnimation--darkMode': darkMode,
                'LoadingAnimation--spinning': animationState !== LOADING_STATE.INITIALIZING && animationState !== LOADING_STATE.COMPLETE,
                'LoadingAnimation--loading': animationState === LOADING_STATE.LOADING && animationState !== LOADING_STATE.COMPLETE,
                'LoadingAnimation--loaded': animationState === LOADING_STATE.LOADED && animationState !== LOADING_STATE.COMPLETE,
            })}
        >
            <LoadingIcon/>
        </div>
    );
}

LoadingAnimation.propTypes = {
    loading: PropTypes.bool,
    darkMode: PropTypes.bool,
    onLoadAnimationComplete: PropTypes.func,
};

export default LoadingAnimation;
