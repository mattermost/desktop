// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

function useAnimationEnd(
  ref,
  callback,
  animationName,
  allowEventBubbling = true,
) {
  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    function handleAnimationend(event) {
      if (!allowEventBubbling && event.target !== ref.current) {
        return;
      }
      if (animationName && animationName !== event.animationName) {
        return;
      }
      callback(event);
    }

    ref.current.addEventListener('animationend', handleAnimationend);

    return () => {
      if (!ref.current) {
        return;
      }
      ref.current.removeEventListener('animationend', handleAnimationend);
    };
  }, [ref, callback, animationName, allowEventBubbling]);
}

export default useAnimationEnd;
