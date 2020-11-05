// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

function useAnimationEnd(
  animationRef,
  callback = () => {}, /* eslint-disable-line no-empty-function */
  animationName = null,
  matchChildElements = true,
) {
  React.useEffect(() => {
    if (!animationRef.current) {
      return null;
    }
    animationRef.current.addEventListener('animationend', handleAnimationend);
    return () => {
      animationRef.current.removeEventListener('animationend', handleAnimationend);
    };
  }, [animationRef]);

  function handleAnimationend(event) {
    if (!matchChildElements && event.target !== animationRef.current) {
      return;
    }
    if (animationName && animationName !== event.animationName) {
      return;
    }
    callback(event);
  }
}

export default useAnimationEnd;
