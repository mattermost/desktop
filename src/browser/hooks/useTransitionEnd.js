// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

function useTransitionEnd(
  transitionRef,
  callback = () => {}, /* eslint-disable-line no-empty-function */
  targetProperty = null,
  matchChildElements = true,
) {
  React.useEffect(() => {
    if (!transitionRef.current) {
      return null;
    }
    transitionRef.current.addEventListener('transitionend', handleTransitionend);
    return () => {
      transitionRef.current.removeEventListener('transitionend', handleTransitionend);
    };
  }, [transitionRef]);

  function handleTransitionend(event) {
    if (!matchChildElements && event.target !== transitionRef.current) {
      return;
    }
    if (targetProperty && targetProperty !== event.propertyName) {
      return;
    }
    callback(event);
  }
}

export default useTransitionEnd;
