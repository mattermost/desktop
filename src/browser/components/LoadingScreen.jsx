// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import useTransitionEnd from '../../hooks/useTransitionEnd.js';

import LoadingAnimation from '../LoadingAnimation';

function LoadingScreen({loading = false, darkMode = false}) {
  const loadingScreenRef = React.useRef(null);

  const [loadingIsComplete, setLoadingIsComplete] = React.useState(true);
  const [loadAnimationIsComplete, setLoadAnimationIsComplete] = React.useState(true);
  const [fadeOutIsComplete, setFadeOutIsComplete] = React.useState(true);

  React.useEffect(() => {
    // reset internal state if loading restarts
    if (loading) {
      resetState();
    }
    if (!loading) {
      setLoadingIsComplete(true);
    }
  }, [loading]);

  function handleLoadAnimationComplete() {
    setLoadAnimationIsComplete(true);
  }

  useTransitionEnd(loadingScreenRef, React.useCallback(() => {
    setFadeOutIsComplete(true);
  }), ['opacity']);

  function loadingInProgress() {
    return !(loadingIsComplete && loadAnimationIsComplete && fadeOutIsComplete);
  }

  function resetState() {
    setLoadingIsComplete(false);
    setLoadAnimationIsComplete(false);
    setFadeOutIsComplete(false);
  }

  const loadingScreen = loadingInProgress() ? (
    <div
      ref={loadingScreenRef}
      className={classNames('LoadingScreen', {
        'LoadingScreen--darkMode': darkMode,
        'LoadingScreen--loaded': loadingIsComplete && loadAnimationIsComplete,
      })}
    >
      <LoadingAnimation
        loading={loading}
        darkMode={darkMode}
        onLoadAnimationComplete={handleLoadAnimationComplete}
      />
    </div>
  ) : null;

  return loadingScreen;
}

LoadingScreen.propTypes = {
  loading: PropTypes.bool,
  darkMode: PropTypes.bool,
};

export default LoadingScreen;
