// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import LoadingAnimation from '../LoadingAnimation';

function LoadingScreen({loading = false, darkMode = false}) {
  const [loadAnimationComplete, setLoadAnimationComplete] = React.useState(false);

  React.useEffect(() => {
    // reset internal state if loading screen is shown
    if (loading && loadAnimationComplete) {
      setLoadAnimationComplete(false);
    }
  }, [loading]);

  function handleLoadAnimationComplete() {
    setLoadAnimationComplete(true);
  }

  return (
    <div
      className={classNames('LoadingScreen', {
        'LoadingScreen--darkMode': darkMode,
        'LoadingScreen--loaded': !loading && loadAnimationComplete,
      })}
    >
      <LoadingAnimation
        loading={loading}
        darkMode={darkMode}
        onLoadAnimationComplete={handleLoadAnimationComplete}
      />
    </div>
  );
}

LoadingScreen.propTypes = {
  loading: PropTypes.bool,
  darkMode: PropTypes.bool,
};

export default LoadingScreen;
